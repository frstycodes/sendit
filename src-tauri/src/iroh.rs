use std::path::PathBuf;

use iroh::{protocol::Router, NodeAddr};
use quic_rpc::transport::flume::FlumeConnector;
use tauri::Error;

pub(crate) type BlobsClient = iroh_blobs::rpc::client::blobs::Client<
    FlumeConnector<iroh_blobs::rpc::proto::Response, iroh_blobs::rpc::proto::Request>,
>;

#[derive(Clone, Debug)]
pub(crate) struct Iroh {
    #[allow(dead_code)]
    router: Router,
    pub(crate) blobs: BlobsClient,
    pub(crate) node_addr: NodeAddr,
}

impl Iroh {
    pub async fn new(path: PathBuf) -> Result<Self, Error> {
        // create dir if it doesn't already exist
        tokio::fs::create_dir_all(&path).await?;

        // create endpoint
        let endpoint = iroh::Endpoint::builder().discovery_n0().bind().await?;
        let node_addr = endpoint.node_addr().await?;

        // build the protocol router
        let mut builder = iroh::protocol::Router::builder(endpoint);

        // add iroh blobs
        let blobs = iroh_blobs::net_protocol::Blobs::persistent(&path)
            .await?
            .build(builder.endpoint());
        builder = builder.accept(iroh_blobs::ALPN, blobs.clone());

        let router = builder.spawn().await?;

        let blobs_client = blobs.client().clone();

        Ok(Self {
            node_addr,
            router,
            blobs: blobs_client,
        })
    }

    #[allow(dead_code)]
    pub(crate) async fn shutdown(&self) -> Result<(), String> {
        self.router.shutdown().await.map_err(|e| e.to_string())
    }
}
