import { promises as fs } from 'fs'
import * as _ from 'lodash'

type ValueType = string

interface FieldQueryOperator<T = any> {
  $gt?: T
  $lt?: T
  $eq?: T
  $in?: T[]
}

type FieldQueryAll<T> = {
  [K in keyof T]: FieldQueryOperator<T[K]> | T[K]
}

type FieldQuery<T> = Partial<FieldQueryAll<T>>

interface Query1<T> {
  $and?: FieldQuery<T>[]
  $or?: FieldQuery<T>[]
}

interface TextQuery<T> {
  $text?: ValueType
}

type Query<T> = Query1<T> | FieldQuery<T> | TextQuery<T>

const isSimpleQuery = <T>(q: Query<T>): q is FieldQuery<T> => {
  return !('$text' in q || '$and' in q || '$or' in q)
}

const isTextQuery = <T>(q: Query<T>): q is TextQuery<T> => {
  return '$text' in q
}

export class Database<T> {
  protected filename: string
  protected fullTextSearchFieldNames: (keyof T)[]

  constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
    this.filename = filename
    this.fullTextSearchFieldNames = fullTextSearchFieldNames
  }

  async find(query: Query<T>): Promise<T[]> {
    const content = await fs.readFile(this.filename, 'utf-8')
    const store = content
      .split('\n')
      .filter((l) => l.startsWith('E'))
      .map((l) => {
        return JSON.parse(l.replace(/^E/, '')) as T
      })
    if (isSimpleQuery(query)) {
      return this.handleSingle(store, query)
    }

    if (isTextQuery(query)) {
      return this.textQuery(store, query)
    }

    return this.complexQuery(store, query)
  }

  private textQuery(arr: T[], query: TextQuery<T>) {
    const qq = query.$text!.toString().toLocaleLowerCase()
    const res = arr.filter((it) => {
      for (const field of this.fullTextSearchFieldNames) {
        if (
          ((it[field] as any) as string)
            .toLocaleLowerCase()
            .split(' ')
            .includes(qq)
        ) {
          return true
        }
      }
      return false
    })

    return res
  }

  private complexQuery(arr: T[], query: Query1<T>) {
    if (query.$and !== undefined) {
      const res = query.$and.map((q) => this.handleSingle(arr, q))
      return this.mergeComplexRes(res, '$and')
    }
    if (query.$or !== undefined) {
      const res = query.$or.map((q) => this.handleSingle(arr, q))
      return this.mergeComplexRes(res, '$or')
    }
    throw new Error('not impl op')
  }

  private mergeComplexRes(rs: T[][], op: '$and' | '$or') {
    if (op === '$or') {
      return _.flatten(rs)
    }
    if (op === '$and') {
      return _.intersection(...rs)
    }
    throw new Error('not impl op')
  }

  private handleSingle(arr: T[], query: FieldQuery<T>) {
    let res: T[] = arr
    ;(Object.keys(query) as (keyof T)[]).forEach((field) => {
      res = this.singleFillter(res, field, query[field] as FieldQueryOperator)
    })
    return res
  }

  private singleFillter(arr: T[], key: keyof T, op: FieldQueryOperator) {
    if (op.$eq !== undefined) {
      return arr.filter((it) => it[key] === op.$eq)
    }
    if (op.$gt !== undefined) {
      return arr.filter((it) => it[key] > op.$gt)
    }
    if (op.$lt !== undefined) {
      return arr.filter((it) => it[key] < op.$lt)
    }
    if (op.$in !== undefined) {
      return arr.filter((it) => op.$in?.includes(it[key]))
    }

    return arr.filter((it) => it[key] === op)
  }
}
