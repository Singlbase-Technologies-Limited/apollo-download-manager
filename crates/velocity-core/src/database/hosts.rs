//! What the transfer engine learned about servers (#325), kept so later downloads from them start
//! at the right pace after a restart. Only the host and port, two counts and a time are kept;
//! nothing here is ever exported (PO decision on #325).

use super::{to_sql_int, Database, DatabaseError};
use crate::transfer::HostMemory;

/// How long a server is remembered after a download from it last taught something (PO decision
/// on #325).
pub const HOST_MEMORY_MS: u64 = 7 * 24 * 60 * 60 * 1000;

/// The most servers remembered; the ones seen longest ago go first.
pub const MAX_HOSTS: usize = 500;

impl Database {
    /// Keeps what was learned about `memory.host`, seen at `now_ms`, replacing what was known.
    pub fn save_host(&self, memory: &HostMemory, now_ms: u64) -> Result<(), DatabaseError> {
        self.conn().execute(
            "INSERT INTO host_memory (host, connections, throttled_to, seen_at_ms)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (host) DO UPDATE SET connections = excluded.connections,
                                              throttled_to = excluded.throttled_to,
                                              seen_at_ms = excluded.seen_at_ms",
            rusqlite::params![
                memory.host,
                memory.connections,
                memory.throttled_to,
                to_sql_int(now_ms)?
            ],
        )?;
        Ok(())
    }

    /// The servers remembered at `now_ms`: seen within [`HOST_MEMORY_MS`], at most [`MAX_HOSTS`],
    /// the most recent first.
    pub fn hosts(&self, now_ms: u64) -> Result<Vec<HostMemory>, DatabaseError> {
        let conn = self.conn();
        let mut statement = conn.prepare(
            "SELECT host, connections, throttled_to FROM host_memory WHERE seen_at_ms >= ?1
             ORDER BY seen_at_ms DESC, host LIMIT ?2",
        )?;
        let rows = statement.query_map(
            rusqlite::params![
                to_sql_int(now_ms.saturating_sub(HOST_MEMORY_MS))?,
                MAX_HOSTS as i64
            ],
            |r| {
                Ok(HostMemory {
                    host: r.get(0)?,
                    connections: r.get(1)?,
                    throttled_to: r.get(2)?,
                })
            },
        )?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Forgets the servers [`Database::hosts`] no longer gives at `now_ms`.
    pub fn forget_old_hosts(&self, now_ms: u64) -> Result<(), DatabaseError> {
        self.conn().execute(
            "DELETE FROM host_memory WHERE seen_at_ms < ?1 OR host NOT IN
             (SELECT host FROM host_memory ORDER BY seen_at_ms DESC, host LIMIT ?2)",
            rusqlite::params![
                to_sql_int(now_ms.saturating_sub(HOST_MEMORY_MS))?,
                MAX_HOSTS as i64
            ],
        )?;
        Ok(())
    }

    /// Forgets every server (the Settings button, #325).
    pub fn forget_hosts(&self) -> Result<(), DatabaseError> {
        self.conn().execute("DELETE FROM host_memory", [])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const T0: u64 = 1_792_600_000_000;
    const DAY: u64 = 24 * 60 * 60 * 1000;

    fn host(name: &str, connections: Option<u32>, throttled_to: Option<u32>) -> HostMemory {
        HostMemory {
            host: name.to_owned(),
            connections,
            throttled_to,
        }
    }

    #[test]
    fn a_server_is_remembered_with_what_was_learned_last() {
        let db = Database::open_in_memory().unwrap();
        db.save_host(&host("example.com:443", Some(3), None), T0)
            .unwrap();
        db.save_host(&host("example.com:443", Some(2), Some(4)), T0 + 1)
            .unwrap();
        db.save_host(&host("mirror.example:80", None, Some(2)), T0 + 2)
            .unwrap();
        assert_eq!(
            db.hosts(T0 + 3).unwrap(),
            [
                host("mirror.example:80", None, Some(2)),
                host("example.com:443", Some(2), Some(4)),
            ]
        );
    }

    #[test]
    fn a_server_not_seen_for_7_days_is_forgotten() {
        let db = Database::open_in_memory().unwrap();
        db.save_host(&host("old.example:443", Some(3), None), T0)
            .unwrap();
        db.save_host(&host("new.example:443", Some(2), None), T0 + 6 * DAY)
            .unwrap();
        let later = T0 + 7 * DAY + 1;
        assert_eq!(
            db.hosts(later).unwrap(),
            [host("new.example:443", Some(2), None)]
        );
        db.forget_old_hosts(later).unwrap();
        let rows: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM host_memory", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 1, "the old one is gone from the database");
    }

    #[test]
    fn at_most_500_servers_are_kept_and_the_oldest_go_first() {
        let db = Database::open_in_memory().unwrap();
        for i in 0..(MAX_HOSTS as u64 + 5) {
            db.save_host(&host(&format!("h{i}.example:443"), Some(2), None), T0 + i)
                .unwrap();
        }
        let now = T0 + 1_000;
        let kept = db.hosts(now).unwrap();
        assert_eq!(kept.len(), MAX_HOSTS);
        assert_eq!(kept[0].host, format!("h{}.example:443", MAX_HOSTS + 4));
        db.forget_old_hosts(now).unwrap();
        assert!(!db
            .hosts(now)
            .unwrap()
            .iter()
            .any(|h| h.host == "h0.example:443"));
    }

    #[test]
    fn forgetting_clears_every_server() {
        let db = Database::open_in_memory().unwrap();
        db.save_host(&host("example.com:443", Some(3), None), T0)
            .unwrap();
        db.forget_hosts().unwrap();
        assert_eq!(db.hosts(T0).unwrap(), []);
    }

    #[test]
    fn only_the_host_counts_and_time_are_stored() {
        let db = Database::open_in_memory().unwrap();
        let columns: Vec<String> = db
            .conn()
            .prepare("SELECT name FROM pragma_table_info('host_memory') ORDER BY cid")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            columns,
            ["host", "connections", "throttled_to", "seen_at_ms"]
        );
    }
}
