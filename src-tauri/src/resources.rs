use serde::{de::DeserializeOwned, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::models::{AppConfig, PetConfig};

pub fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
    let data = fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    serde_json::from_str(&data)
        .map_err(|error| format!("failed to parse {}: {error}", path.display()))
}

pub fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    let data = serde_json::to_string_pretty(value)
        .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?;
    fs::write(path, data).map_err(|error| format!("failed to write {}: {error}", path.display()))
}

fn resource_root(resource_dir: &Path) -> PathBuf {
    let bundled_root = resource_dir.join("_up_");
    if bundled_root.exists() {
        bundled_root
    } else {
        resource_dir.to_path_buf()
    }
}

pub fn bundled_app_config_path(resource_dir: &Path) -> PathBuf {
    resource_root(resource_dir)
        .join("config")
        .join("config.json")
}

pub fn user_app_config_path(app_config_dir: &Path) -> PathBuf {
    app_config_dir.join("config.json")
}

pub fn ensure_user_app_config(resource_dir: &Path, app_config_dir: &Path) -> Result<PathBuf, String> {
    let user_config_path = user_app_config_path(app_config_dir);
    if !user_config_path.exists() {
        if let Some(parent) = user_config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }
        fs::copy(bundled_app_config_path(resource_dir), &user_config_path)
            .map_err(|error| format!("failed to seed {}: {error}", user_config_path.display()))?;
    }
    Ok(user_config_path)
}

pub fn pet_config_path(resource_dir: &Path, pet_name: &str) -> PathBuf {
    resource_root(resource_dir)
        .join("assets")
        .join("pets")
        .join(pet_name)
        .join("config.json")
}

pub fn pet_assets_path(resource_dir: &Path) -> PathBuf {
    resource_root(resource_dir).join("assets").join("pets")
}

pub fn read_app_config(resource_dir: &Path, app_config_dir: &Path) -> Result<AppConfig, String> {
    let path = ensure_user_app_config(resource_dir, app_config_dir)?;
    read_json_file(&path)
}

pub fn write_app_config(app_config_dir: &Path, config: &AppConfig) -> Result<(), String> {
    write_json_file(&user_app_config_path(app_config_dir), config)
}

pub fn read_pet_config(resource_dir: &Path, pet_name: &str) -> Result<PetConfig, String> {
    read_json_file(&pet_config_path(resource_dir, pet_name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn builds_resource_paths() {
        let root = Path::new("/tmp/app");

        assert_eq!(
            bundled_app_config_path(root),
            PathBuf::from("/tmp/app/config/config.json")
        );
        assert_eq!(
            pet_config_path(root, "cat"),
            PathBuf::from("/tmp/app/assets/pets/cat/config.json")
        );
        assert_eq!(pet_assets_path(root), PathBuf::from("/tmp/app/assets/pets"));
        assert_eq!(user_app_config_path(Path::new("/tmp/user")), PathBuf::from("/tmp/user/config.json"));
    }

    #[test]
    fn builds_bundled_resource_paths() {
        let directory = tempfile::tempdir().expect("temp dir");
        fs::create_dir(directory.path().join("_up_")).expect("create bundled root");

        assert_eq!(
            bundled_app_config_path(directory.path()),
            directory
                .path()
                .join("_up_")
                .join("config")
                .join("config.json")
        );
        assert_eq!(
            pet_config_path(directory.path(), "cat"),
            directory
                .path()
                .join("_up_")
                .join("assets")
                .join("pets")
                .join("cat")
                .join("config.json")
        );
        assert_eq!(
            pet_assets_path(directory.path()),
            directory.path().join("_up_").join("assets").join("pets")
        );
    }

    #[test]
    fn reads_json_file() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = directory.path().join("pet.json");
        fs::write(
            &path,
            r#"{"name":"小猫咪","size":64,"frames":{"idle":["idle_0.png"]}}"#,
        )
        .expect("write pet config");

        let pet: PetConfig = read_json_file(&path).expect("read pet config");

        assert_eq!(pet.name, "小猫咪");
        assert_eq!(pet.frames["idle"], vec!["idle_0.png".to_string()]);
    }
}
