use std::{
    collections::HashMap,
    ops::{Deref, DerefMut},
    str::FromStr,
};

use iroh_blobs::Hash;

#[derive(Debug, Clone)]
pub struct File {
    pub name: String,
    pub icon: String,
    pub size: u64,
    pub hash: Hash,
}

#[derive(Debug, Clone)]
pub struct Files(HashMap<String, File>);

impl Deref for Files {
    type Target = HashMap<String, File>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Files {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl Files {
    pub fn new() -> Self {
        Files(HashMap::new())
    }

    pub fn get(&self, name: &str) -> Option<&File> {
        self.0.get(name)
    }

    pub fn add_file(&mut self, file: File) {
        self.0.insert(file.name.clone(), file);
    }

    pub fn remove_file(&mut self, name: &str) {
        self.0.remove(name);
    }

    pub fn has_file(&self, name: &str) -> bool {
        self.0.contains_key(name)
    }

    pub fn clear(&mut self) {
        self.0.clear();
    }
}

impl ToString for Files {
    fn to_string(&self) -> String {
        let mut str = String::new();

        for (_, file) in &self.0 {
            str.push_str(&format!(
                "{}\0{}\0{}\0{}\n",
                file.name, file.icon, file.size, file.hash
            ));
        }

        str
    }
}

impl From<String> for Files {
    fn from(value: String) -> Self {
        let mut files = Files::new();

        for line in value.lines() {
            let parts: Vec<&str> = line.split('\0').collect();
            if parts.len() == 4 {
                let name = parts[0].to_string();
                let icon = parts[1].to_string();
                let size = parts[2].parse().unwrap_or(0);
                let hash = Hash::from_str(parts[3]).unwrap_or_else(|_| Hash::EMPTY);
                let file = File {
                    name: name.clone(),
                    icon: icon.clone(),
                    size,
                    hash,
                };
                files.add_file(file);
            }
        }

        files
    }
}

impl From<&str> for Files {
    fn from(value: &str) -> Self {
        Files::from(value.to_string())
    }
}
