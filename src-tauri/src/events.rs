use serde::Serialize;

// DOWNLOAD
pub const DOWNLOAD_FILE_ADDED: &str = "DOWNLOAD_FILE_ADDED";
pub const DOWNLOAD_FILE_PROGRESS: &str = "DOWNLOAD_FILE_PROGRESS";
pub const DOWNLOAD_FILE_COMPLETED: &str = "DOWNLOAD_FILE_COMPLETED";
pub const DOWNLOAD_ALL_COMPLETE: &str = "DOWNLOAD_ALL_COMPLETE";
pub const DOWNLOAD_FILE_ERROR: &str = "DOWNLOAD_FILE_ERROR";
pub const DOWNLOAD_FILE_ABORTED: &str = "DOWNLOAD_FILE_ABORTED";
pub const CANCEL_DOWNLOAD: &str = "CANCEL_DOWNLOAD";

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileAdded {
    pub name: String,
    pub icon: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileProgress {
    pub name: String,
    pub progress: f32,
    pub speed: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileCompleted {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileAborted {
    pub name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileError {
    pub name: String,
    pub error: String,
}

// UPLOAD
pub const UPLOAD_FILE_ADDED: &str = "UPLOAD_FILE_ADDED";
pub const UPLOAD_FILE_PROGRESS: &str = "UPLOAD_FILE_PROGRESS";
pub const UPLOAD_FILE_COMPLETED: &str = "UPLOAD_FILE_COMPLETED";
pub const UPLOAD_FILE_REMOVED: &str = "UPLOAD_FILE_REMOVED";

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileAdded {
    pub name: String,
    pub icon: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileProgress {
    pub path: String,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileRemoved {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileCompleted {
    pub name: String,
}

// REMOVE_FILE
