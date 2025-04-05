use std::{
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use file_icon_provider::get_file_icon as get_file_icon_pkg;
use image::{DynamicImage, RgbaImage};
use tauri::{AppHandle, Manager};

pub fn file_name_from_path(path: &PathBuf) -> Result<String, String> {
    let name = path
        .file_name()
        .ok_or("Failed to get file name")?
        .to_string_lossy()
        .to_string();
    Ok(name)
}

pub fn get_download_dir(handle: &AppHandle) -> Result<PathBuf, String> {
    let dir = handle
        .path()
        .download_dir()
        .map_err(|_| "Failed to get download directory")?
        .join("sendit");
    Ok(dir)
}

pub struct Throttle {
    last_emit: Instant,
    interval: Duration,
}

impl Throttle {
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
            return true;
        }
        false
    }
}

pub fn get_file_icon(path: impl AsRef<Path>) -> Result<String, String> {
    let icon = get_file_icon_pkg(path, 64).map_err(|e| format!("{}", e))?;
    let image = RgbaImage::from_raw(icon.width, icon.height, icon.pixels)
        .map(DynamicImage::ImageRgba8)
        .expect("Failed to convert icon to image");

    let mut png_data: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_data);
    image
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image to PNG: {}", e))?;

    let png_string = format!("data:image/png;base64,{}", base64::encode(png_data));
    Ok(png_string)
}

pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[macro_export]
macro_rules! log {
    ($level:expr, $($arg:tt)*) => {{
        let formatted = format!($($arg)*);
        match $level {
            LogLevel::Debug => log::debug!("DEBUG: {}", formatted),
            LogLevel::Info => log::info!("INFO: {}", formatted),
            LogLevel::Warn => log::warn!("WARN: {}", formatted),
            LogLevel::Error => log::error!("ERROR: {}", formatted),
        }
        formatted
    }};
}
