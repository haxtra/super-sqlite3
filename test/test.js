const assert = require('assert')
const Equal = assert.strictEqual
const EqualArr = assert.deepEqual
const Throws = assert.throws

const Builder = require('../src/builder')

const b = new Builder(null, 'tblnme')
let r;

if(typeof describe == 'undefined'){
	console.log('Use Mocha to run this test')
	process.exit(1)
}

describe('builder', function(){

	describe('select', function(){

		it('flat', function(){
			Equal(
				b.reset().select('field', 'field2').buildSQLSelect()[0],
				'SELECT field, field2 FROM tblnme;')
		})

		it('array', function(){
			Equal(
				b.reset().select(['field', 'field2']).buildSQLSelect()[0],
				'SELECT field, field2 FROM tblnme;')
		})

		it('object/alias', function(){
			Equal(
				b.reset().select({field:'alias', field2:true}).buildSQLSelect()[0],
				'SELECT field AS alias, field2 FROM tblnme;')
		})

		it('mixed', function(){
			Equal(
				b.reset().select([{field:'alias'}, 'field2']).buildSQLSelect()[0],
				'SELECT field AS alias, field2 FROM tblnme;')
		})

		it('star', function(){
			Equal(
				b.reset().select('*', {field:'alias'}).buildSQLSelect()[0],
				'SELECT *, field AS alias FROM tblnme;')
		})

		describe('error', function(){

			it('select:blank', function(){
				// let query fail if you forget select args
				Equal(
					b.reset().select().buildSQLSelect()[0],
					'SELECT  FROM tblnme;')
			})
		})
	})

	describe('join', function(){

		describe('inner', function(){

			it('str', function(){
				r = b.reset().join('table2', 'field').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme INNER JOIN table2 USING (field);')
				EqualArr(r[1],	[])
			})

			it('array', function(){
				r = b.reset().join('table2', ['field', 'field2']).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme INNER JOIN table2 USING (field, field2);')
				EqualArr(r[1],	[])
			})

			it('object', function(){
				r = b.reset().join('table2', {'tblnme.tab_id':'table2.id'}).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme INNER JOIN table2 ON tblnme.tab_id=table2.id;')
				EqualArr(r[1],	[])
			})

			it('alias', function(){
				r = b.reset().innerJoin('table2', {'tblnme.tab_id':'table2.id'}).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme INNER JOIN table2 ON tblnme.tab_id=table2.id;')
				EqualArr(r[1],	[])
			})
		})

		describe('left outer', function(){

			it('str', function(){
				r = b.reset().leftJoin('table2', 'field').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme LEFT OUTER JOIN table2 USING (field);')
				EqualArr(r[1],	[])
			})

			it('array', function(){
				r = b.reset().leftJoin('table2', ['field', 'field2']).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme LEFT OUTER JOIN table2 USING (field, field2);')
				EqualArr(r[1],	[])
			})

			it('object', function(){
				r = b.reset().leftJoin('table2', {'tblnme.tab_id':'table2.id'}).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme LEFT OUTER JOIN table2 ON tblnme.tab_id=table2.id;')
				EqualArr(r[1],	[])
			})

			it('alias', function(){
				r = b.reset().leftOuterJoin('table2', {'tblnme.tab_id':'table2.id'}).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme LEFT OUTER JOIN table2 ON tblnme.tab_id=table2.id;')
				EqualArr(r[1],	[])
			})
		})

		describe('error', function(){
			it('no param', function(){
				Throws(() => r = b.reset().join('table2').buildSQLSelect(),
						{message: 'Invalid join param, must be string, array or object'})
			})
		})
	})

	describe('where', function(){

		it('flat equal', function(){
			r = b.reset().where('id', 'foo').buildSQLSelect()
			Equal(r[0],	'SELECT * FROM tblnme WHERE id=?;')
			EqualArr(r[1],	['foo'])
		})

		it('flat op', function(){
			r = b.reset().where('id', '>', 3).buildSQLSelect()
			Equal(r[0],	'SELECT * FROM tblnme WHERE id>?;')
			EqualArr(r[1],	[3])
		})

		it('nested array', function(){
			r = b.reset().where([['id', 15], ['num', '>', 100]]).buildSQLSelect()
			Equal(r[0],	'SELECT * FROM tblnme WHERE id=? AND num>?;')
			EqualArr(r[1],	[15, 100])
		})

		it('object', function(){
			r = b.reset().where({field:'value', field2:'value2'}).buildSQLSelect()
			Equal(r[0],	'SELECT * FROM tblnme WHERE field=? AND field2=?;')
			EqualArr(r[1],	['value', 'value2'])
		})

		it('mixed', function(){
			r = b.reset().where([['field', 'value'], {field2:'value2', field3:'value3'}, ['field4', '>', 4]]).buildSQLSelect()
			Equal(r[0],	'SELECT * FROM tblnme WHERE field=? AND field2=? AND field3=? AND field4>?;')
			EqualArr(r[1],	['value', 'value2', 'value3', 4])
		})

		it('throw on invalid', function(){
			Throws(() => b.reset().where('field', '@', 'foo'),
					{message: 'Invalid WHERE clause operator: @'})
		})

		describe('where not', function(){

			it('flat', function(){
				r = b.reset().whereNot('foo', 3).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo!=?;')
				EqualArr(r[1],	[3])
			})

			it('object', function(){
				r = b.reset().whereNot({foo:3}).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo!=?;')
				EqualArr(r[1],	[3])
			})
		})

		describe('where in', function(){

			it('flat', function(){
				r = b.reset().whereIn('foo', ['a', 2]).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo IN (?,?);')
				EqualArr(r[1],	['a',2])
			})
		})

		describe('where not in', function(){

			it('flat', function(){
				r = b.reset().whereNotIn('foo', ['b', 3]).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo NOT IN (?,?);')
				EqualArr(r[1],	['b',3])
			})
		})

		describe('where null', function(){

			it('flat', function(){
				r = b.reset().whereNull('foo', 'bar').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo IS NULL AND bar IS NULL;')
				EqualArr(r[1],	[])
			})

			it('array', function(){
				r = b.reset().whereNull(['foo', 'bar']).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo IS NULL AND bar IS NULL;')
				EqualArr(r[1],	[])
			})

			it('object', function(){
				r = b.reset().whereNull({foo:1, bar:true, baz:false}).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo IS NULL AND bar IS NULL;')
				EqualArr(r[1],	[])
			})
		})

		describe('where not null', function(){

			it('flat', function(){
				r = b.reset().whereNotNull('foo', 'bar').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme WHERE foo IS NOT NULL AND bar IS NOT NULL;')
				EqualArr(r[1],	[])
			})
		})

	})

	describe('order, limit & offset', function(){

		describe('order', function(){

			it('default', function(){
				r = b.reset().order('field').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme ORDER BY field ASC;')
				EqualArr(r[1],	[])
			})

			it('sort param', function(){
				r = b.reset().order('field', 'DESC').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme ORDER BY field DESC;')
				EqualArr(r[1],	[])
			})

			it('capitalize', function(){
				r = b.reset().order('field', 'desc').buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme ORDER BY field DESC;')
				EqualArr(r[1],	[])
			})

			it('throw on invalid', function(){
				Throws(() => b.reset().order('field', 'foo'),
						{message: 'Invalid sort param: foo'})
			})
		})

		describe('limit & offset', function(){

			it('limit', function(){
				r = b.reset().limit(11).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme LIMIT 11;')
				EqualArr(r[1],	[])
			})

			it('offset', function(){
				r = b.reset().offset(111).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme OFFSET 111;')
				EqualArr(r[1],	[])
			})

			it('limit & offset', function(){
				r = b.reset().limit(5).offset(6).buildSQLSelect()
				Equal(r[0],	'SELECT * FROM tblnme LIMIT 5 OFFSET 6;')
				EqualArr(r[1],	[])
			})
		})
	})

	describe('insert', function(){
		// .buildSQLInsert == .insert sans the execution
		it('insert', function(){
			r = b.reset().buildSQLInsert({foo:'bar', baz:3})
			Equal(r[0],	'INSERT INTO tblnme (foo, baz) VALUES (?,?);')
			EqualArr(r[1],	['bar', 3])
		})
	})

	describe('upsert', function(){
		// .buildSQLInsert == .insert sans the execution
		it('base', function(){
			r = b.reset().buildSQLUpsert({foo:'bar', baz:3})
			Equal(r[0],	'INSERT INTO tblnme (foo, baz) VALUES (?,?) ON CONFLICT DO UPDATE SET foo=excluded.foo, baz=excluded.baz;')
			EqualArr(r[1],	['bar', 3])
		})

		it('conflict str', function(){
			r = b.reset().buildSQLUpsert({foo:'bar', baz:3}, 'foo')
			Equal(r[0],	'INSERT INTO tblnme (foo, baz) VALUES (?,?) ON CONFLICT (foo) DO UPDATE SET baz=excluded.baz;')
			EqualArr(r[1],	['bar', 3])
		})

		it('conflict arr', function(){
			r = b.reset().buildSQLUpsert({one:'1st', two:2, three:'tre'}, ['one', 'two'])
			Equal(r[0],	'INSERT INTO tblnme (one, two, three) VALUES (?,?,?) ON CONFLICT (one, two) DO UPDATE SET three=excluded.three;')
			EqualArr(r[1],	['1st', 2, 'tre'])
		})
	})

	describe('update', function(){
		// .buildSQLUpdate == .update sans the execution

		it('basic', function(){
			r = b.reset().buildSQLUpdate({foo:'bar', baz:3})
			Equal(r[0],	'UPDATE tblnme SET foo=?, baz=?;')
			EqualArr(r[1],	['bar', 3])
		})

		it('where', function(){
			r = b.reset().where('field', 'value').buildSQLUpdate({foo:'bar', baz:3})
			Equal(r[0],	'UPDATE tblnme SET foo=?, baz=? WHERE field=?;')
			EqualArr(r[1],	['bar', 3, 'value'])
		})

		it('null', function(){
			r = b.reset().buildSQLUpdate({foo:null})
			Equal(r[0],	'UPDATE tblnme SET foo=?;')
			EqualArr(r[1],	[null])
		})
	})

	describe('delete', function(){
		// .buildSQLDelete == .delete sans the execution

		it('all', function(){
			r = b.reset().buildSQLDelete(true)
			Equal(r[0],	'DELETE FROM tblnme;')
			EqualArr(r[1],	[])
		})

		it('where', function(){
			r = b.reset().where({id:3}).buildSQLDelete()
			Equal(r[0],	'DELETE FROM tblnme WHERE id=?;')
			EqualArr(r[1],	[3])
		})

		it('limit', function(){
			r = b.reset().limit(4).buildSQLDelete()
			Equal(r[0],	'DELETE FROM tblnme LIMIT 4;')
			EqualArr(r[1],	[])
		})

		it('limit where', function(){
			r = b.reset().where('field', '>', 3).limit(4).buildSQLDelete()
			Equal(r[0],	'DELETE FROM tblnme WHERE field>? LIMIT 4;')
			EqualArr(r[1],	[3])
		})

	})

	describe('count', function(){

		it('count blind', function(){
			r = b.reset().buildSQLCount()
			Equal(r[0],	'SELECT count(*) AS count FROM tblnme;')
			EqualArr(r[1],	[])
		})

		it('count known', function(){
			r = b.reset().where({answer:42}).buildSQLCount()
			Equal(r[0],	'SELECT count(answer) AS count FROM tblnme WHERE answer=?;')
			EqualArr(r[1],	[42])
		})

		it('error: count join', function(){
			Throws(() => r = b.reset().join('table2', 'field').buildSQLCount(),
				{message: 'SQLBuilderError: count on table joins is not supported'})
		})
	})

	describe('extras', function(){
		it('id', function(){
			r = b.reset().id(22).buildSQLSelect()
			Equal(r[0],	'SELECT * FROM tblnme WHERE id=?;')
			EqualArr(r[1],	[22])
		})
	})

	describe('full query', function(){

		it('woohoo', function(){
			r = b.reset()
				.select('foo', 'bar', ['one','two'], {three:'four'})
				.join('table2', {'tblnme.tab2_id':'table2.id'})
				.leftJoin('table3', {'tblnme.tab3_id':'table3.id'})
				.where('a', 1)
				.where('b', '>', 2)
				.where([['c', 3], ['d', '<', 4]])
				.where({e:'eee'})
				.whereNot('f', 'g')
				.whereIn('arr', ['a','b','c'])
				.whereNotIn('arr2', ['aa','bb','cc'])
				.whereNull('empty')
				.whereNotNull('full')
				.order('field')
				.limit(22)
				.offset(33)
				.buildSQLSelect(true)
			Equal(r[0],	'SELECT foo, bar, one, two, three AS four FROM tblnme ' +
						'INNER JOIN table2 ON tblnme.tab2_id=table2.id ' +
						'LEFT OUTER JOIN table3 ON tblnme.tab3_id=table3.id ' +
						'WHERE a=? AND b>? AND c=? AND d<? AND e=? AND f!=? AND arr IN (?,?,?) AND arr2 NOT IN (?,?,?) AND empty IS NULL AND full IS NOT NULL ' +
						'ORDER BY field ASC ' +
						'LIMIT 22 OFFSET 33;')
			EqualArr(r[1],	[1, 2, 3, 4, 'eee', 'g', 'a', 'b', 'c', 'aa', 'bb', 'cc'])
		})
	})
})
