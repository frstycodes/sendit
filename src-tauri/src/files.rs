use std::{
    collections::HashMap,
    ops::{Deref, DerefMut},
    str::FromStr,
};

use base64::{engine::general_purpose, Engine};
use iroh_blobs::Hash;
use serde::{Deserialize, Serialize};

use crate::iroh::GossipTicket;

const VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct File {
    pub name: String,
    pub icon: String,
    pub size: u64,
    pub hash: Hash,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Files {
    pub version: u32,
    pub gossip_ticket: GossipTicket,
    pub files: HashMap<String, File>,
}

impl Deref for Files {
    type Target = HashMap<String, File>;

    fn deref(&self) -> &Self::Target {
        &self.files
    }
}

impl DerefMut for Files {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.files
    }
}

impl Files {
    pub fn new(ticket: GossipTicket) -> Self {
        Self {
            version: VERSION,
            gossip_ticket: ticket,
            files: HashMap::new(),
        }
    }

    pub fn add_file(&mut self, file: File) {
        self.files.insert(file.name.clone(), file);
    }

    pub fn remove_file(&mut self, name: &str) {
        self.files.remove(name);
    }

    pub fn has_file(&self, name: &str) -> bool {
        self.files.contains_key(name)
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("Infallible")
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        serde_json::from_slice(bytes).map_err(|e| format!("Failed to parse bytes: {}", e))
    }
}

impl ToString for Files {
    fn to_string(&self) -> String {
        let mut text = general_purpose::STANDARD.encode(&self.to_bytes());
        text.make_ascii_lowercase();
        format!("")
    }
}

impl FromStr for Files {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let bytes = general_purpose::STANDARD
            .decode(s.as_bytes())
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        let files = Self::from_bytes(&bytes)?;

        if files.version != VERSION {
            return Err(format!(
                "Version mismatch: expected {}, got {}",
                VERSION, files.version
            ));
        }
        Ok(files)
    }
}
