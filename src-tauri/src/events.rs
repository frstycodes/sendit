use serde::Serialize;

// DOWNLOAD
pub const DOWNLOAD_FILE_ADDED: &str = "DOWNLOAD_FILE_ADDED";
pub const DOWNLOAD_FILE_PROGRESS: &str = "DOWNLOAD_FILE_PROGRESS";
pub const DOWNLOAD_FILE_COMPLETED: &str = "DOWNLOAD_FILE_COMPLETED";
// pub const DOWNLOAD_FILE_ABORTED: &str = "DOWNLOAD_FILE_ABORTED";
// pub const DOWNLOAD_FILE_EXISTS: &str = "DOWNLOAD_FILE_EXISTS";
pub const DOWNLOAD_ALL_COMPLETE: &str = "DOWNLOAD_ALL_COMPLETE";

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileAdded {
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileProgress {
    pub name: String,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileCompleted(pub String);

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileAborted {
    pub name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadFileExists(pub String);

// UPLOAD
pub const UPLOAD_FILE_ADDED: &str = "UPLOAD_FILE_ADDED";
pub const UPLOAD_FILE_PROGRESS: &str = "UPLOAD_FILE_PROGRESS";
pub const UPLOAD_FILE_COMPLETED: &str = "UPLOAD_FILE_COMPLETED";
pub const UPLOAD_FILE_REMOVED: &str = "UPLOAD_FILE_REMOVED";

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileAdded {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileProgress {
    pub path: String,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileRemoved(pub String);

#[derive(Debug, Clone, Serialize)]
pub struct UploadFileCompleted(pub String);

// REMOVE_FILE
