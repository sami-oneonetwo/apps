// Wraps node:sqlite so it looks like a Durable Object's ctx.storage.sql.
import { DatabaseSync } from "node:sqlite";

export function memorySql(path = ":memory:") {
  const db = new DatabaseSync(path);
  return {
    db,
    exec(query, ...bindings) {
      const st = db.prepare(query);
      const rows = /^\s*select/i.test(query) ? st.all(...bindings) : (st.run(...bindings), []);
      return { toArray: () => rows };
    },
  };
}
