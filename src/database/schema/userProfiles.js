import { getDb } from "#db/sqlite";

export const UserProfile = {
  get db() {
    return getDb();
  },

  findById(id) {
    const row = this.db
      .prepare("SELECT * FROM user_profiles WHERE user_id = ?")
      .get(id);
    return row ? this._deserialise(row) : null;
  },

  findOrCreate(id, defaults = {}) {
    const existing = this.findById(id);
    if (existing) return existing;

    this.db
      .prepare(
        `INSERT OR IGNORE INTO user_profiles (user_id, tagline, description, location, age, profession, banner_url, font_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        defaults.tagline || null,
        defaults.description || null,
        defaults.location || null,
        defaults.age || null,
        defaults.profession || null,
        defaults.bannerUrl || null,
        defaults.fontId || "zillaslab",
      );

    return this.findById(id);
  },

  update(id, data) {
    const colMap = {
      tagline: "tagline",
      description: "description",
      location: "location",
      age: "age",
      profession: "profession",
      bannerUrl: "banner_url",
      fontId: "font_id",
    };

    const setClauses = [];
    const values = [];

    for (const [key, col] of Object.entries(colMap)) {
      if (data[key] === undefined) continue;
      setClauses.push(`${col} = ?`);
      values.push(data[key]);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = datetime('now')`);
    values.push(id);

    this.db
      .prepare(
        `UPDATE user_profiles SET ${setClauses.join(", ")} WHERE user_id = ?`,
      )
      .run(...values);
  },

  delete(id) {
    this.db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(id);
  },

  findAll() {
    return this.db
      .prepare("SELECT * FROM user_profiles")
      .all()
      .map(this._deserialise);
  },

  _deserialise(row) {
    return {
      userId: row.user_id,
      tagline: row.tagline || null,
      description: row.description || null,
      location: row.location || null,
      age: row.age || null,
      profession: row.profession || null,
      bannerUrl: row.banner_url || null,
      fontId: row.font_id || "zillaslab",
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },
};
