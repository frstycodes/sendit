use std::path::PathBuf;

pub fn file_name(path: &PathBuf) -> Result<String, String> {
    let name = path
        .file_name()
        .ok_or("Failed to get file name")?
        .to_string_lossy()
        .to_string();
    Ok(name)
}

pub fn name_from_key(key: &[u8]) -> String {
    let mut name = String::from_utf8_lossy(key).to_string();
    if name.len() > 1 {
        name.remove(name.len() - 1);
    }
    name
}
