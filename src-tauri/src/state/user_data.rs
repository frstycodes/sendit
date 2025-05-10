use std::{
    fs::{self},
    path::PathBuf,
};

use anyhow::Result;
use log::info;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

pub const CONFIG_FILE_NAME: &str = "user-data.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct User {
    pub name: String,
    pub avatar: u8,
}

impl User {
    pub fn from_config(path: PathBuf) -> Result<Self> {
        let contents = fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("Failed to read config file: {}", e))?;

        let user: User = serde_json::from_str(&contents)
            .map_err(|e| anyhow::anyhow!("Failed to parse config file: {}", e))?;

        Ok(user)
    }

    pub fn save(&self, path: PathBuf) -> Result<()> {
        println!("{}", path.display());
        let contents = serde_json::to_string(self)
            .map_err(|e| anyhow::anyhow!("Failed to serialize user data: {}", e))?;

        if !path.exists() {
            fs::create_dir_all(&path)?
        }

        fs::write(path, contents)
            .map_err(|e| anyhow::anyhow!("Failed to write config file: {}", e))?;

        info!("User data saved successfully");

        Ok(())
    }
}

#[tauri::command]
pub fn is_onboarded(app: AppHandle) -> bool {
    let cfg_dir = app.path().config_dir();

    match cfg_dir {
        Err(_) => false,
        Ok(path) => path.join(CONFIG_FILE_NAME).exists(),
    }
}
