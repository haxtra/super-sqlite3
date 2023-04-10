class Builder {

	constructor(db, tableName){
		this.db = db
		this.table = tableName
		this.reset()
	}

	reset() {
		this.obj = {
			type: 'SELECT',
			table: this.table,
			key: 'id',
			select: ['*'],
			join: [],
			where: [],
			whereIn: [],
			whereNotIn: [],
			whereNull: [],
			whereNotNull: [],
			order: null,
			limit: null,
			offset: null,
		}
		return this
	}

	// Builder ////////////////////////////////////////////

	#buildSQL(sql, values) {
		// this is shared between select, update, delete

		// where
		const where = this.buildSQLWhere()

		if(where){
			sql.push('WHERE ' + where[0].join(' AND '))
			values = values.concat(where[1])
		}

		// order
		if(this.obj.order){
			sql.push('ORDER BY ' + this.obj.order[0] + ' ' + this.obj.order[1])
		}

		// limit
		if(this.obj.limit){
			sql.push(`LIMIT ${this.obj.limit}`)
		}

		// offset
		if(this.obj.offset){
			sql.push(`OFFSET ${this.obj.offset}`)
		}

		return [sql.join(' ') + ';', values]
	}

	#qMarks(arr){
		return Array(arr.length).fill('?').join(',')
	}

	buildSQLInsert(data){
		const keys = Object.keys(data)
		const values = Object.values(data)
		const sql = `INSERT INTO ${this.obj.table} (${keys.join(', ')}) VALUES (${this.#qMarks(values)});`
		return [sql, values]
	}

	buildSQLUpsert(data, conflicting=[]){
		const keys = Object.keys(data)
		const values = Object.values(data)

		if(typeof conflicting == 'string')
			conflicting = [conflicting]

		const conflict = conflicting.length ? `(${conflicting.join(', ')}) ` : ''
		// remove conflicting items from set, these will not change
		const set = keys.filter(key => !conflicting.includes(key)).map(key => `${key}=excluded.${key}`).join(', ')

		const sql = `INSERT INTO ${this.obj.table} (${keys.join(', ')}) VALUES (${this.#qMarks(values)}) ON CONFLICT ${conflict}DO UPDATE SET ${set};`

		return [sql, values]
	}

	buildSQLSelect() {

		const sql = [`SELECT ${this.obj.select.join(', ')} FROM ${this.obj.table}`]

		for(const clause of this.obj.join)
			sql.push(`${clause[0]} ${clause[1]} ${clause[2]}`)

		return this.#buildSQL(sql, [])
	}

	buildSQLUpdate(data){
		const keys = Object.keys(data)
		const values = Object.values(data)
		return this.#buildSQL([`UPDATE ${this.obj.table} SET ${keys.map(key => key + '=?').join(', ')}`], values)
	}

	buildSQLDelete() {
		return this.#buildSQL([`DELETE FROM ${this.obj.table}`], [])
	}

	buildSQLCount() {
		if(this.obj.join.length)
			throw new Error('SQLBuilderError: count on table joins is not supported')

		// use known field for performance, fall back to *
		const field = this.obj.where.length ? this.obj.where[0][0] : '*'
		return this.#buildSQL([`SELECT count(${field}) AS count FROM ${this.obj.table}`], [])
	}

	buildSQLWhere(){
		const where = []
		let values = []

		if(this.obj.where.length){
			for(const w of this.obj.where){
				where.push(w[0] + w[1] + '?')
				values.push(w[2])
			}
		}

		if(this.obj.whereIn.length){
			for(const w of this.obj.whereIn){
				where.push(w[0] + ' IN (' + this.#qMarks(w[1]) + ')')
				values = values.concat(w[1])
			}
		}

		if(this.obj.whereNotIn.length){
			for(const w of this.obj.whereNotIn){
				where.push(w[0] + ' NOT IN (' + this.#qMarks(w[1]) + ')')
				values = values.concat(w[1])
			}
		}

		if(this.obj.whereNull.length){
			for(const w of this.obj.whereNull){
				where.push(w + ' IS NULL')
			}
		}

		if(this.obj.whereNotNull.length){
			for(const w of this.obj.whereNotNull){
				where.push(w + ' IS NOT NULL')
			}
		}

		return where.length
				? [where, values]
				: null
	}

	// Runners ////////////////////////////////////////////

	get() {
		const sql = this.buildSQLSelect()
		return this.db.prepare(sql[0]).get(sql[1])
	}

	all() {
		const sql = this.buildSQLSelect()
		return this.db.prepare(sql[0]).all(sql[1])
	}

	count() {
		const sql = this.buildSQLCount()
		const res = this.db.prepare(sql[0]).get(sql[1])
		return res.count
	}

	exists() {
		return this.count() > 0
	}

	// SELECT /////////////////////////////////////////////

	select(args) {
		// accepts:
		//  - str, str, str
		//  - [str, str, str]
		//  - {str:alias}
		// or any combination

		// only one call is allowed
		this.obj.select = []
		this.parseSelect(this.obj.select, arguments)
		return this
	}

	parseSelect(container, args){

		for(const arg of args){
			if(Array.isArray(arg))
				this.parseSelect(container, arg)
			else if(typeof arg == 'string')
				container.push(arg)
			else if(typeof arg == 'object'){
				for(const key in arg)
					if(arg[key] === true)
						container.push(key)
					else
						container.push(key + ' AS ' + arg[key])
			}
		}
	}

	// JOIN ///////////////////////////////////////////////

	join(table, on){
		// table: str
		//    on: -|str|arr|obj
		this.obj.join.push(['INNER JOIN', table, this.parseJoinOn(on)])
		return this
	}

	innerJoin() {
		return this.join(...arguments)
	}

	leftJoin(table, on) {
		this.obj.join.push(['LEFT OUTER JOIN', table, this.parseJoinOn(on)])
		return this
	}

	leftOuterJoin() {
		return this.leftJoin(...arguments)
	}

	parseJoinOn(on){
		if(typeof on == 'string'){
			return `USING (${on})`
		} else if(Array.isArray(on)){
			return `USING (${on.join(', ')})`
		} else if(typeof on == 'object'){
			const link = Object.entries(on)[0]
			return `ON ${link[0]}=${link[1]}`
		} else {
			throw new Error('Invalid join param, must be string, array or object')
		}
	}

	// INSERT /////////////////////////////////////////////

	insert(data){
		const sql = this.buildSQLInsert(data)
		const res = this.db.prepare(sql[0]).run(sql[1]) // { changes: 1, lastInsertRowid: 5 }
		return res.lastInsertRowid
	}

	// UPSERT /////////////////////////////////////////////

	upsert(data, conflicting){
		/** Upsert record. Non zero return value means insert (rowId), zero means update. **/
		const sql = this.buildSQLUpsert(data, conflicting)
		const res = this.db.prepare(sql[0]).run(sql[1]) // insert: {changes:1, lastInsertRowid:50} update: {changes:1, lastInsertRowid:0}
		return res.lastInsertRowid
	}

	// UPDATE /////////////////////////////////////////////

	update(data){
		const sql = this.buildSQLUpdate(data)
		const res = this.db.prepare(sql[0]).run(sql[1]) // { changes: 3, lastInsertRowid: 0 }
		return res.changes
	}

	// DELETE /////////////////////////////////////////////

	delete() {
		const sql = this.buildSQLDelete()
		const res = this.db.prepare(sql[0]).run(sql[1]) // { changes: 3, lastInsertRowid: 0 }
		return res.changes
	}

	// WHERE //////////////////////////////////////////////

	where(args){
		// accepts:
		// - field, value (equal, single)
		// - field, operator, value (single)
		// - [[field, value], [field, operator , value], ...] (equal, multiple)
		// - {field:value} (equal, multiple)
		// - [[field, value], {field:value}, [field, operator , value], ...] (mixed, multiple)
		// this.obj.where = []
		this.parseWhere(this.obj.where, '=', ...arguments)
		return this
	}

	whereNot(){
		this.parseWhere(this.obj.where, '!=', ...arguments)
		return this
	}

	whereIn(field, arr){
		this.obj.whereIn.push([field, arr])
		return this
	}

	whereNotIn(field, arr){
		this.obj.whereNotIn.push([field, arr])
		return this
	}

	whereNull(args){
		// accepts
		// - str
		// - str, str, str
		// - [str, str, str]
		// - {str:truthy, str:truthy}
		this.parseWhereNull(this.obj.whereNull, ...arguments)
		return this
	}

	whereNotNull(args){
		this.parseWhereNull(this.obj.whereNotNull, ...arguments)
		return this
	}

	parseWhere(container, operator, param1, param2, param3) {
		if(typeof param1 == 'object'){
			if(Array.isArray(param1)){
				// array, flat or nested
				if(Array.isArray(param1[0])){
					// nested
					for(const arr of param1)
						this.parseWhere(container, operator, arr)
				} else {
					// flat
					if(param1[2])
						// f, o, v
						container.push([param1[0], this.#validateWhereOperator(param1[1]), param1[2]])
					else
						// f, v
						container.push([param1[0], operator, param1[1]])
				}
			} else {
				// object
				for(const key in param1)
					container.push([key, operator, param1[key]])
			}
		} else if(param3) {
			// f, o, v
			container.push([param1, this.#validateWhereOperator(param2), param3])
		} else {
			// f, v
			container.push([param1, operator, param2])
		}
	}

	parseWhereNull(container, ...args){
		for(const arg of args){
			if(Array.isArray(arg)){
				for(const ar of arg)
					this.parseWhereNull(container, ar)
			} else if(typeof arg == 'object'){
				for(const field in arg)
					if(arg[field])
						container.push(field)
			} else {
				container.push(arg)
			}
		}
	}

	// valid SQLite comparison operators
	#whereOperators = ['=', '==', '!=', '<>', '>', '<', '>=', '<=', '!<', '!>']
	#validateWhereOperator(op) {
		if(!this.#whereOperators.includes(op))
			throw new Error('Invalid WHERE clause operator: ' + op)
		return op
	}

	// OTHER //////////////////////////////////////////////

	order(field, sort='ASC'){

		if(!this.#order.includes(sort))
			throw new Error('Invalid sort param: ' + sort)

		this.obj.order = [field, sort.toUpperCase()]
		return this
	}

	// valid sort values
	#order = ['ASC', 'asc', 'DESC', 'desc']


	limit(val) {
		this.obj.limit = parseInt(val)
		return this
	}

	offset(val) {
		this.obj.offset = parseInt(val)
		return this
	}

	// Extras /////////////////////////////////////////////

	id(id){
		// quick selector for an id
		this.where({id})
		return this
	}

	getId(id){
		// quick getter
		this.where({id})
		return this.get()
	}
}

module.exports = Builder
