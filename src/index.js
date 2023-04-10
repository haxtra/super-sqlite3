const Database = require('better-sqlite3-multiple-ciphers')
const Builder = require('./builder.js')

function connect(dbPath, opts={}){

	if(opts.log)
		opts.verbose = opts.log

	let db = new Database(dbPath, opts)

	function connection(table){
		/** Get new Builder instance or underlying BSMC object **/
		if(table)
			return new Builder(db, table)
		else
			return db
	}

	connection.$ = db
	connection.close = () => db.close()


	// Querying ///////////////////////////////////////////

	connection.query   = (sql) => db.prepare(sql)
	connection.prepare = (sql) => db.prepare(sql)

	connection.table = (table) => new Builder(db, table)

	connection.exec = (sql) => db.exec(sql)

	connection.execFile = (filePath) => {
		const sql = require('fs').readFileSync(filePath, 'utf8').toString()
		db.exec(sql)
	}

	connection.pragma = (sql, opts) => db.pragma(sql, opts)
	connection.pragmaValue = sql => db.pragma(sql, {simple:true})


	// Shorthands //////////////////////////////////////////

	connection.get = (sql, values) => {
		return db.prepare(sql).get(values)
	}

	connection.all = (sql, values) => {
		return db.prepare(sql).all(values)
	}

	connection.run = (sql, values) => {
		return db.prepare(sql).run(values)
	}

	connection.raw = (sql, values) => {
		return db.prepare(sql).raw(values)
	}

	connection.runFile = connection.execFile


	// Bulk Insert ////////////////////////////////////////

	// pragma values applied temporarily on bulk insert
	// see: https://www.sqlite.org/pragma.html
	connection._bulkInsertPragma = {
		journal_mode: 'MEMORY',
		locking_mode: 'EXCLUSIVE',
		synchronous: 'OFF',
		cache_size: -1000000, // gb of memory | int:pages, -int:kibibytes
		temp_store: 'MEMORY',
	}

	connection.bulkInsert = (inserter) => {

		// read current pragma values
		const originalPragma = {}

		for(const pragma of Object.keys(connection._bulkInsertPragma))
			originalPragma[pragma] = db.pragma(pragma, {simple:true})

		// apply speedy, but unsafe pragma values
		for(const pragma in connection._bulkInsertPragma)
			db.pragma(`${pragma}=${connection._bulkInsertPragma[pragma]};`)

		// begin transaction
		db.exec('BEGIN TRANSACTION')

		// run inserts
		inserter(connection) // pass super-sqlite3 object

		// commit transaction
		db.exec('COMMIT')

		// revert pragma settings
		for(const pragma in originalPragma)
			db.pragma(`${pragma}=${originalPragma[pragma]};`)
	}


	// Schema /////////////////////////////////////////////

	connection.tables = () => {
		/** List tables in the database **/
		const res = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;").all()
		return res.map(entry => entry.name)
	}

	connection.hasTable = (table) => {
		/** Return bool if given table exists in the database **/
		const res = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?;").get(table)
		return !!res
	}

	connection.columns = (table) => {
		/** Get list of column names in a table (native order) **/
		const res = db.prepare(`pragma table_info('${table}')`).all()
		return res.map(entry => entry.name)
	}

	connection.columnsExt = (table) => {
		/** Get extended list of columns in a table.
			Contains info on column type, default values, nulls and primary key.
		**/
		const columns = {}
		const res = db.prepare(`pragma table_info('${table}')`).all()
		for(const entry of res)
			columns[ entry.name ] = {type:entry.type, defualt:entry.dflt_value, notnull:entry.notnull, primary:entry.pk}

		return columns
	}

	connection.schema = (tables) => {
		/** Get schema definition of entire database, or specific tables.
				@tables 	undefined(all)|string|array
		**/

		tables = tables
					? (Array.isArray(tables) ? tables : [tables])
					: connection.tables()

		const schema = []

		for(const table of tables)
			schema.push(`--- ${table} ---\n` + connection._getTableSchema(table))

		return schema.join('\n\n')
	}

	connection._getTableSchema = (table) => {
		/** Get original query that created the table **/
		const res = db.prepare(`SELECT sql FROM sqlite_master WHERE name=?;`).get(table)
		return res ? res.sql + ';' : null
	}

	connection.indexes = (table) => {
		/** Get list of indexes for given table or entire database  **/
		if(table)
			return db.prepare("SELECT tbl_name AS 'table', name AS 'index' FROM sqlite_master WHERE type='index' AND tbl_name=?;").all(table)
		else
			return db.prepare("SELECT tbl_name AS 'table', name AS 'index' FROM sqlite_master WHERE type='index' ORDER BY tbl_name ASC;").all()
	}


	// Stats //////////////////////////////////////////////

	connection.count = (tables) => {
		/** Return object with row counts for an entire db, or specific tables.
		 		@tables 	undefined(all)|string|array
		**/

		tables = tables
					? (Array.isArray(tables) ? tables : [tables])
					: connection.tables() // get all

		const counts = {}
		for(const table of tables){
			// find primary key prior to count, for performance
			const res = db.prepare(`SELECT name FROM pragma_table_info('${table}') WHERE pk=1;`).get()
			// fall back to * in case of none
			const field = res ? res.name : '*'
			counts[table] = db.prepare(`SELECT count(${field}) AS count FROM '${table}';`).get().count
		}

		return counts
	}


	// Encryption /////////////////////////////////////////

	connection.encrypt = function(key){
		/** Encrypts entire database file with given key.
			Note: will close and recreate connection.
			Important: always have backup before running this.
		**/

		// set encryption key
		db.pragma(`rekey='${key}'`)

		// db must be closed for encryption to take effect
		db.close()

		// reopen database as new connection
		db = connection.$ = new Database(dbPath, opts)

		// unlock it
		db.pragma(`key='${key}'`)

		// run VACUUM on freshly encrypted db
		db.exec('VACUUM;')

		// report success
		return connection.isUnlocked()
	}

	connection.decrypt = function(){
		/** Permanently decrypts database and disables encryption.
			You're probably looking for .unlock()
		**/

		// ensure db is unlocked
		if(!connection.isUnlocked())
			throw new Error('SQLite: database must be unlocked prior to decryption')

		// remove encryption
		db.pragma("rekey=''")

		// close db for decryption to take effect
		db.close()

		// reopen database as new connection
		db = connection.$ = new Database(dbPath, opts)

		// run VACUUM on decrypted db
		db.exec('VACUUM;')

		// report success
		return connection.isUnlocked()
	}

	connection.unlock = function(key){
		/** Unlock encrypted database.
			Returns bool for success.
		**/
		db.pragma(`key='${key}'`)
		return connection.isUnlocked()
	}

	connection.isUnlocked = function(){
		/** Check if database is unlocked.
			Returns `true` for plain and empty databases.
			Returns `false` for encrypted and invalid databases.
		**/
		try {
			db.prepare('PRAGMA encoding').get()
			return true
		} catch(err) {
			if(err.code == 'SQLITE_NOTADB')
				return false
			else
				throw err
		}
	}


	// Alternation ////////////////////////////////////////

	connection.altergen = (table) => {
		/** Generates set of queries to freely alter table schema.
		 	Useful for inserting new columns at arbitrary position, or rearranging
		 	existing ones.
			Note: any indexes, triggers and views will need to be recreated.
			See point 7 at https://www.sqlite.org/lang_altertable.html
		**/

		// get table schema
		const schema = connection._getTableSchema(table)
		if(!schema) return null

		// remove everything outside the braces
		const stripped = /(\([a-zA-Z0-9-_,\'"\s{}]*\))/ig.exec(schema)[1]

		// get columns
		const columns = connection.columns(table)

		// create name for intermediary table
		const tempTable = '__tmp__' + table

		// create alter queryset
		const altergen =
			`-- alter: ${table.toUpperCase()}\n\n` +
			`BEGIN TRANSACTION;\n\n` +
			`CREATE TABLE "${tempTable}" ` +
			`${stripped};\n\n` +
			`INSERT INTO "${tempTable}" SELECT \n` +
			columns.join(',\n') + '\n' +
			`FROM "${table}";\n\n` +
			`DROP TABLE "${table}";\n` +
			`ALTER TABLE "${tempTable}" RENAME TO "${table}";\n` +
			`COMMIT;\n` +
			`VACUUM;`

		return altergen
	}


	// Backup /////////////////////////////////////////////

	connection.backup = async function(opts={}){
		/** Create copy of currently used database.
		 	Returns path to created backup file.
		 	Provide file or dir option.
			opts.file     -- absolute path to backup file
			opts.dir      -- path to backup dir (current db dir by default), filename will be derived from current name.
			opts.time     -- [bool] add time to datestamp, default true
			opts.progress -- https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md#backupdestination-options---promise
		**/

		if(opts.file){
			// absolute path
			await db.backup(opts.file, opts)
			return opts.file
		} else {

			// create timestamp
			const u = new Date()
			const d = new Date(u - u.getTimezoneOffset() * 60 * 1000)
			const timestamp = params.time === false
				? d.toISOString().split('T')[0]
				: d.toISOString().split('.')[0].replace('T','-').replace(/:/g,'-')

			// break path
			const file = require('path').parse(dbPath)

			// create base filename
			// ie: database--2027-09-16.sqlite
			let filePath = file.name + '--' + timestamp + file.ext

			if(params.dir)
				// use specified dir
				filePath = params.dir.replace(/\/$/, '') + '/' + filePath // remove trailing slash
			else
				// use same dir as source file
				filePath = file.dir + '/' + filePath

			// make copy
			await db.backup(filePath, opts)

			// return path to backup file
			return filePath
		}
	}

	return connection
}

module.exports = connect