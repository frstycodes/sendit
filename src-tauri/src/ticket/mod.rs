use crate::state::State;
use tracing::info;

#[tauri::command]
pub async fn generate_ticket(state: State<'_>) -> Result<String, String> {
    info!("Generating ticket");
    let files = state.files().await;
    let header_str = files.to_string();

    let res = state
        .iroh()
        .blobs
        .add_bytes(header_str)
        .await
        .map_err(|e| format!("Failed to add header file: {}", e))?;

    let ticket = iroh_blobs::ticket::BlobTicket::new(state.iroh().node_addr.clone(), res.hash, res.format)
        .map_err(|e| format!("Failed to create ticket: {}", e))?;

    let mut tickets = state.header_tickets.lock().await;
    tickets.push(ticket.clone());

    Ok(ticket.to_string())
}