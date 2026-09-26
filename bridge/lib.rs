//! In-process Node binding over agent-browser's native command engine.
//!
//! This file is injected into a checked-out upstream release at build time.
//! It does not start the agent-browser executable or an MCP server.
#![allow(dead_code)]

mod ca_bundle;
mod color;
mod commands;
mod connection;
mod flags;
mod install;
mod native;
mod output;
mod plugins;
mod read;
mod validation;

use napi::bindgen_prelude::Result;
use napi_derive::napi;
use serde_json::{json, Value};
use tokio::sync::Mutex;

/// One stateful browser session owned by a DSH agent session.
#[napi]
pub struct BrowserSession {
    state: Mutex<native::actions::DaemonState>,
}

#[napi]
impl BrowserSession {
    #[napi(constructor)]
    pub fn new(session_id: String) -> Result<Self> {
        if !validation::is_valid_session_name(&session_id) {
            return Err(napi::Error::from_reason(validation::session_name_error(&session_id)));
        }
        let mut state = native::actions::DaemonState::new();
        state.session_id = session_id.clone();
        state.pin_tab = matches!(
            std::env::var("AGENT_BROWSER_PIN_TAB").as_deref(),
            Ok("1" | "true" | "yes")
        ) || native::tab_binding::load(&session_id)
            .ok()
            .flatten()
            .is_some_and(|binding| binding.pinned);
        Ok(Self { state: Mutex::new(state) })
    }

    /// Execute a native browser action without IPC or a separate process.
    #[napi]
    pub async fn execute(&self, command_json: String) -> Result<String> {
        let command: Value = serde_json::from_str(&command_json)
            .map_err(|error| napi::Error::from_reason(format!("Invalid browser action JSON: {error}")))?;
        if !command.is_object() || command.get("action").and_then(Value::as_str).is_none() {
            return Err(napi::Error::from_reason("Browser action must be an object with an action string"));
        }
        let mut state = self.state.lock().await;
        let response = native::actions::execute_command(&command, &mut state).await;
        serde_json::to_string(&response)
            .map_err(|error| napi::Error::from_reason(format!("Cannot serialize browser response: {error}")))
    }

    /// Close the browser attached to this session.
    #[napi]
    pub async fn close(&self) -> Result<String> {
        self.execute(json!({ "action": "close" }).to_string()).await
    }
}

#[napi]
pub fn upstream_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
