use std::path::{Path, PathBuf};

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

pub fn get_file_icon(path: &Path) -> Result<String, String> {
    let icon = file_icon_provider::get_file_icon(path, 32)
        .map_err(|e| format!("Failed to get file icon: {}", e));

    match icon {
        Ok(icon) => {
            let string = String::from_utf8(icon.pixels.to_vec())
                .map_err(|e| format!("Failed to convert icon pixels to string: {}", e))?;
            Ok(string)
        }
        Err(e) => {
            println!("Icon error: {}", e);
            Err(e)
        }
    }
}
