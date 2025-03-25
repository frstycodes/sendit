use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

pub fn file_name_from_path(path: &PathBuf) -> Result<String, String> {
    let name = path
        .file_name()
        .ok_or("Failed to get file name")?
        .to_string_lossy()
        .to_string();
    Ok(name)
}

pub fn file_name_from_key(key: &[u8]) -> String {
    let mut name = String::from_utf8_lossy(key).to_string();
    if name.len() > 1 {
        name.remove(name.len() - 1);
    }
    name
}

pub struct Debouncer {
    last_emit: Instant,
    interval: Duration,
}

impl Debouncer {
    pub fn new(interval: Duration) -> Self {
        Self {
            last_emit: Instant::now() - interval,
            interval,
        }
    }

    pub fn is_free(&mut self) -> bool {
        let now = Instant::now();
        if now.duration_since(self.last_emit) >= self.interval {
            self.last_emit = now;
            true
        } else {
            false
        }
    }
}
