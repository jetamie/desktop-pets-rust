use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppConfig {
    pub current_pet: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_mode: Option<String>,
    pub interval_seconds: u64,
    pub display_duration_seconds: u64,
    pub move_speed: f64,
    pub idle_timeout_seconds: u64,
    pub pet_size: u32,
    pub bottom_margin: u32,
    pub animation_interval_ms: u64,
    pub game_modes: GameModes,
    pub greetings: Greetings,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EditableConfig {
    pub current_pet: String,
    pub interval_seconds: u64,
    pub move_speed: f64,
    pub pet_size: u32,
    pub current_mode: Option<String>,
    pub game_modes: GameModes,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GameModes {
    pub default: String,
    pub schedules: Vec<GameModeSchedule>,
    pub modes: HashMap<String, GameModeDefinition>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GameModeSchedule {
    pub mode: String,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GameModeDefinition {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Greetings {
    pub morning: Vec<String>,
    pub noon: Vec<String>,
    pub afternoon: Vec<String>,
    pub evening: Vec<String>,
    pub night: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PetConfig {
    pub name: String,
    pub size: u32,
    pub frames: HashMap<String, Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_app_config_shape() {
        let json = r#"
        {
          "current_pet": "totoro-v2",
          "interval_seconds": 20,
          "display_duration_seconds": 3,
          "move_speed": 5,
          "idle_timeout_seconds": 5,
          "pet_size": 200,
          "bottom_margin": 50,
          "animation_interval_ms": 300,
          "game_modes": {
            "default": "wander",
            "schedules": [{ "mode": "edge", "start_time": "08:00", "end_time": "18:00" }],
            "modes": {
              "wander": { "name": "闲逛模式", "description": "宠物在屏幕上随机移动" },
              "edge": { "name": "边路模式", "description": "宠物沿着屏幕边缘移动", "config": { "path": "right->bottom" } }
            }
          },
          "greetings": {
            "morning": ["早上好！"],
            "noon": ["中午好！"],
            "afternoon": ["下午好！"],
            "evening": ["晚上好！"],
            "night": ["晚安！"]
          }
        }
        "#;

        let config: AppConfig = serde_json::from_str(json).expect("app config should parse");

        assert_eq!(config.current_pet, "totoro-v2");
        assert_eq!(config.current_mode, None);
        assert_eq!(config.pet_size, 200);
        assert_eq!(config.game_modes.schedules[0].mode, "edge");
        assert_eq!(config.greetings.night[0], "晚安！");
    }

    #[test]
    fn parses_current_mode_override() {
        let json = r#"
        {
          "current_pet": "totoro-v2",
          "current_mode": "edge",
          "interval_seconds": 20,
          "display_duration_seconds": 3,
          "move_speed": 5,
          "idle_timeout_seconds": 5,
          "pet_size": 200,
          "bottom_margin": 50,
          "animation_interval_ms": 300,
          "game_modes": {
            "default": "wander",
            "schedules": [],
            "modes": {
              "wander": { "name": "闲逛模式", "description": "宠物在屏幕上随机移动" },
              "edge": { "name": "边路模式", "description": "宠物沿着屏幕边缘移动" }
            }
          },
          "greetings": {
            "morning": [],
            "noon": [],
            "afternoon": [],
            "evening": [],
            "night": []
          }
        }
        "#;

        let config: AppConfig = serde_json::from_str(json).expect("app config should parse");

        assert_eq!(config.current_mode, Some("edge".to_string()));
    }
    #[test]
    fn parses_editable_config_with_current_pet() {
        let json = r#"
        {
          "current_pet": "cat",
          "interval_seconds": 20,
          "move_speed": 5,
          "pet_size": 200,
          "current_mode": "edge",
          "game_modes": {
            "default": "wander",
            "schedules": [],
            "modes": {
              "wander": { "name": "闲逛模式", "description": "宠物在屏幕上随机移动" },
              "edge": { "name": "边路模式", "description": "宠物沿着屏幕边缘移动" }
            }
          }
        }
        "#;

        let config: EditableConfig = serde_json::from_str(json).expect("editable config should parse");

        assert_eq!(config.current_pet, "cat");
        assert_eq!(config.current_mode, Some("edge".to_string()));
    }

    #[test]
    fn parses_pet_config_shape() {
        let json = r#"
        {
          "name": "龙猫-v2",
          "size": 2048,
          "frames": {
            "idle": ["1.png", "2.png"],
            "walk": ["1.png"],
            "jump": ["1.png", "2.png", "3.png"]
          }
        }
        "#;

        let pet: PetConfig = serde_json::from_str(json).expect("pet config should parse");

        assert_eq!(pet.name, "龙猫-v2");
        assert_eq!(
            pet.frames["idle"],
            vec!["1.png".to_string(), "2.png".to_string()]
        );
    }
}
