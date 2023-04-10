# super-sqlite3

Lightning fast SQLite library with optional full db encryption, simple query builder, and a host of utility features, all in one neat package.


## Table of Contents

- [Credits](#credits)
- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
    - [Querying](#querying)
        - [Binding parameters](#binding-parameters)
    - [Bulk statements](#bulk-statements)
    - [Bulk insert mode](#bulk-insert-mode)
    - [Pragma](#pragma)
    - [Count](#count)
    - [Schema](#schema)
    - [Schema alternation](#schema-alternation)
    - [Encryption](#encryption)
    - [Backup](#backup)
    - [Closing](#closing)
- [Query Builder](#query-builder)
    - [Select](#select)
        - [Runners](#runners)
    - [Where](#where)
    - [Order](#order)
    - [Limit & Offset](#limit--offset)
    - [Joins](#joins)
        - [Inner Join](#inner-join)
        - [Left Outer Join](#left-outer-join)
    - [Inserts](#inserts)
        - [Insert](#insert)
        - [Upsert](#upsert)
    - [Update](#update)
    - [Delete](#delete)
- [License](#license)


## Credits

`super-sqlite3` is a thin wrapper around [`better-sqlite3-multiple-ciphers`](https://github.com/m4heshd/better-sqlite3-multiple-ciphers), which extends [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (the fastest SQLite library for node.js) with full database encryption using [`SQLite3MultipleCiphers`](https://github.com/utelle/SQLite3MultipleCiphers). `super-sqlite3` then adds its own query builder and other convenience features.


## Features

- lightning fast **synchronous** API [_(yes, it is)_](https://github.com/WiseLibs/better-sqlite3#how-other-libraries-compare)
- optional full database encryption
- full transaction support
- simple query builder inspired by `knex.js`
- db utility and convenience functions
- great API


## Install

	npm install super-sqlite3


## Usage

```js
const Database = require('super-sqlite3')
const db = new Database('/path/to/file', options?)
```

Options:
- `options.readonly` open the database connection in readonly mode (default: `false`).
- `options.fileMustExist` if the database does not exist, an Error will be thrown instead of creating a new file. This option is ignored for in-memory, temporary, or readonly database connections (default: `false`).
- `options.timeout` the number of milliseconds to wait when executing queries on a locked database, before throwing a `SQLITE_BUSY` error (default: `5000`).
- `options.verbose` provide a function that gets called with every SQL string executed by the database connection (default: `null`).
- `options.nativeBinding` if you're using a complicated build system that moves, transforms, or concatenates your JS files, `better-sqlite3-multiple-ciphers` might have trouble locating its native C++ addon (`better_sqlite3.node`). If you get an error that looks like [this](https://github.com/WiseLibs/better-sqlite3/issues/146#issue-337752663), you can solve it by using this option to provide the file path of `better_sqlite3.node` (relative to the current working directory).


## API

> Note: not all functionality of `better-sqlite3` is directly exposed yet, but you can access the wrapped object instance at `db.$`.


### Querying

`db.query` (aliased `db.prepare`) returns  `Statement` object. Check `better-sqlite3` [docs](https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md#class-statement) for more details.

```js
db.query(sql).run(bindParams?) // exec query
db.query(sql).get(bindParams?) // get single record
db.query(sql).all(bindParams?) // get array of records
db.query(sql).raw(bindParams?) // return data as value arrays, instead of objects
```
You can also use shorthands, but multiple args for binding parameters are not supported, use array or object:

```js
db.run(sql, bindParams?) // exec query
db.get(sql, bindParams?) // get single record
db.all(sql, bindParams?) // get array of records
db.raw(sql, bindParams?) // get array of value arrays
```

#### Binding parameters

Handlers accept optional binding parameters, that are used to prevent [SQL injection](https://en.wikipedia.org/wiki/SQL_injection).

Anonymous parameters use `?` sign for a placeholder:

```js
db.query('INSERT INTO table VALUES (?, ?, ?)').run(1, 2, 3)

// all these are equivalent
.run(1, 2, 3)     // multiple args
.run([1, 2, 3])   // array
.run([1], [2, 3]) // mixed
```

Named parameters use `@`, `$` or `:` followed by a name, and require an object:

```js
db.query('INSERT INTO table VALUES (:foo, @bar, $baz)').run({foo:1, bar:2, baz:3})

````

### Bulk statements

```js
// exec multiple statements
db.exec(queries)

// exec multiple statements from file
db.execFile(pathToFile)
```

### Bulk insert mode

> Note: bulk insert mode is experimental, be cautious

In bulk insert mode, `super-sqlite3` temporarily sets custom `PRAGMA` values, which trade safety for speed. You can view, change, remove, or add your own values, by directly manipulating the object:

```js
console.log(db._bulkInsertPragma)
```

`.bulkInsert` takes one parameter, a function that performs the insertion. A transaction is automatically started before execution and committed immediately afterwards.


```js
db.bulkInsert( db => {...insert...} )
```

### Pragma

`.pragma` allows you to query and set PRAGMA values.

```js
db.pragma('auto_vacuum')
// [ { auto_vacuum: 0 } ]
```

To get bare value, use `.pragmaValue`:

```js
db.pragmaValue('busy_timeout')
// 5000
```

To set the value:

```js
db.pragma('busy_timeout=3000')
```

Full PRAGMA list can be found [here](https://www.sqlite.org/pragma.html).


### Count

Returns the number of rows in the specified table, or all tables if omitted. Returns object.

```js
db.count('table') // single
// { table: 42 }
db.count(['table1', 'table2']) // multiple
// { table1: 42, table2: 420 }
db.count() // all
```

### Schema

`super-sqlite3` provides convenient functions for querying schema.

```js
// get names of all tables
db.tables() // array

// check if table exists
db.hasTable(tableName) // bool

// get column names of a table
db.columns(tableName) // array

// get extended column information
db.columnsExt(tableName) // object

// get table schema sql
// tables - string or array of table names, returns all if omitted
db.schema(tables) // string

// get table indexes
db.indexes(tableName) // object

```

### Schema alternation

`db.altergen` generates a set of queries that help to add/move/update columns while maintaining the intended column order.

```js
db.altergen(tableName) // string
```

### Encryption

`super-sqlite3` uses `ChaCha20-Poly1305` cipher algorithms, the default for `SQLite3MultipleCiphers`. See [docs](https://utelle.github.io/SQLite3MultipleCiphers/docs/ciphers/cipher_chacha20/) for more details.

```js
// encrypt currently opened database
db.encrypt(key)

// PERMANENTLY decrypt the database (once unlocked)
db.decrypt()

// unlock database for a session
db.unlock(key)

// check if db is unlocked
db.isUnlocked()
```

### Backup

Create backup of the database. Returns promise resolving to the path of the backup file created.

```js
await db.backup(options?)
```

Options:
- `options.file` absolute path to backup file
- `options.dir` path to backup dir (defaults to the same dir as the current database). The filename will be derived from the current name, with an added datestamp.
- `options.time` add time to datestamp, defaults to `true`.
- `options.progress` see `better-sqlite3` [documentation](https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md#backupdestination-options---promise).

If options are omitted, the backup file will be stored alongside the current database, using the same name with an added timestamp, so: `database.sqlite` => `database--2027-09-14-09-50-36.sqlite`.


### Closing

Gracefully shut down the database connection.

```js
db.close()
```


## Query Builder

To use query builder, invoke `db` object with table name:

```js
db(table).select(fields).where(conditions).get()
```

> Note: query builder is only intended to help with basic queries, it is not meant to replace SQL.


### Select

Select is the default mode, and can be omitted. Accepts arguments in several formats:

```js
select('field1', 'field2')            // multiple args
select(['field1', 'field2'])          // array
select({field1:'alias', field2:true}) // object

// to alias field:
select('*', {field:'alias'})
```

#### Runners

Select type query must be executed by one of the following:

```js
.get()    // single record
.all()    // array of records
.count()  // record count
.exists() // boolean
```

### Where

```js
// where
where('field', 3)
where('field', '>', 3)
where([ ['field', 3], ['field2', '>', 15] ]) // note single top arg
where({field:3, field2:'value'})

// where not
whereNot('field', 3)
whereNot({field: 3})

// where in
whereIn('field', [5, 8])

// where not in 
whereNotIn('field', [5, 8])

// where null
whereNull('field', 'field2')
whereNull(['field', 'field2'])
whereNull({field:1, field2:true, field3:false}) // field3 not included

// where not null
whereNotNull('field', 'field2')
```

If the table uses `id` as its primary key, a shorthand can be used:

```js
// .id(n) is a shorthand to .where({id:n})
db(table).id(10).get()
// SELECT * FROM table WHERE id=10;

// when id is the only selector in select type query:
db(table).getId(10)
```

### Order

```js
db.order('field') // asc
db.order('field', 'asc')
db.order('field', 'desc')
```

### Limit & Offset

```js
db.limit(100)

db.offset(1000)
```

### Joins

#### Inner Join

```js
db(table).join(table2, field)
db(table).innerJoin(table2, field) // alias
// SELECT * FROM table INNER JOIN table2 USING (field);

db(table).join(table2, [field, field2])
// SELECT * FROM table INNER JOIN table2 USING (field, field2);

db(table).join(table2, {'table.id':'table2.tab_id'})
// SELECT * FROM table INNER JOIN table2 ON table.id=table2.tab_id;
```

#### Left Outer Join

```js
db(table).leftJoin(table2, field)
db(table).leftOuterJoin(table2, field) // alias
// SELECT * FROM table LEFT OUTER JOIN table2 USING (field);

db(table).leftJoin(table2, [field, field2])
// SELECT * FROM table LEFT OUTER JOIN table2 USING (field, field2);

db(table).leftJoin(table2, {'table.id':'table2.tab_id'})
// SELECT * FROM table LEFT OUTER JOIN table2 ON table.id=table2.tab_id;
```

### Inserts

#### Insert

`.insert` returns rowId on success.

```js
db(table).insert({foo:'bar'})
```

#### Upsert

`.upsert` tries to update an existing record, and falls back to insert if it is not found.

```js
db(table).upsert(data, conflict?)

// upsert
db(table).upsert({foo:'bar'})
// INSERT INTO table (foo) VALUES (?)
// ON CONFLICT DO UPDATE SET foo=excluded.foo;

db(table).upsert({foo:'bar', baz:3}, 'foo')
// INSERT INTO table (foo, baz) VALUES (?,?)
// ON CONFLICT (foo)
// DO UPDATE SET baz=excluded.baz;

db(table).upsert({one:'1st', two:2, three:'tre'}, ['one', 'two'])
// INSERT INTO table (one, two, three) VALUES (?,?,?)
// ON CONFLICT (one, two)
// DO UPDATE SET three=excluded.three;
```

`.upsert` returns result object:

```js
{changes:1, lastInsertRowid:0}  // update
{changes:1, lastInsertRowid:42} // insert
```

### Update

`.update` returns the number of affected rows.

```js
db(table).where(cond).update(obj) // int
```

### Delete

`.delete` returns the number of affected rows.

```js
db(table).where(cond).delete() // int
```

## License

MIT