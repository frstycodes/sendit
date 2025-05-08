use std::{
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use data_encoding::BASE64;
use file_icon_provider::get_file_icon as get_file_icon_pkg;
use image::{DynamicImage, RgbaImage};
use iroh_blobs::ticket::BlobTicket;
use tauri::{AppHandle, Manager};

use crate::iroh::BlobsClient;

pub fn file_name_from_path(path: impl AsRef<Path>) -> Result<String, String> {
    let name = path
        .as_ref()
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

    let png_string = format!(
        "data:image/png;base64,{}",
        BASE64.encode(png_data.as_slice())
    );
    Ok(png_string)
}

pub enum LogLevel {
    #[allow(dead_code)]
    Debug,
    #[allow(dead_code)]
    Info,
    #[allow(dead_code)]
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

pub fn validate_file_path(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let path = path
        .as_ref()
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {:?}", e))?;

    if !path.exists() {
        let err = log!(LogLevel::Error, "File does not exist at path");
        return Err(err);
    }

    if path.is_dir() {
        let err = log!(LogLevel::Error, "Directory not supported");
        return Err(err);
    }
    Ok(path)
}

pub async fn download_and_read_header(
    blobs: &BlobsClient,
    ticket: BlobTicket,
) -> Result<String, String> {
    let (node_addr, hash, _) = ticket.into_parts();
    blobs
        .download(hash.clone(), node_addr)
        .await
        .map_err(|e| format!("Failed to download header file: {}", e))?
        .finish()
        .await
        .map_err(|e| format!("Failed to finish downloading header file: {}", e))?;

    let bytes = blobs
        .read_to_bytes(hash)
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?;

    let res = String::from_utf8(bytes.to_vec())
        .map_err(|e| format!("Failed to convert bytes to string: {}", e))?;

    Ok(res)
}

use crate::iroh::Iroh;
#[allow(dead_code)]
pub async fn setup_temp_iroh(suffix: &str, app: &AppHandle) -> Result<Iroh, String> {
    let data_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get temp dir: {:?}", e))?
        .join(format!("sendit-{suffix}"));

    let iroh = Iroh::new(data_dir)
        .await
        .map_err(|e| format!("Failed to initialize iroh: {}", e))?;

    Ok(iroh)
}
