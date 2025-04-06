use std::collections::HashMap;

use iroh_blobs::Hash;

#[derive(Clone)]
pub struct File {
    pub name: String,
    pub icon: String,
    pub size: u64,
    pub hash: Hash,
}

pub struct Files(HashMap<String, File>);

impl Files {
    pub fn new() -> Self {
        Files(HashMap::new())
    }

    pub fn entries(&self) -> &HashMap<String, File> {
        &self.0
    }

    pub fn get(&self, name: &str) -> Option<&File> {
        self.0.get(name)
    }

    pub fn add_file(&mut self, name: String, icon: String, size: u64, hash: Hash) {
        let file = File {
            name: name.clone(),
            icon,
            size,
            hash,
        };
        self.0.insert(name, file);
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
