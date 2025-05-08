use std::{ops::Deref, path::PathBuf, str::FromStr};

use anyhow::Result;
use iroh::{protocol::Router, NodeAddr, NodeId};
use iroh_gossip::{
    net::{Gossip, GossipReceiver, GossipSender},
    proto::TopicId,
};
use quic_rpc::transport::flume::FlumeConnector;
use serde::{Deserialize, Serialize};

pub type BlobsClient = iroh_blobs::rpc::client::blobs::Client<
    FlumeConnector<iroh_blobs::rpc::proto::Response, iroh_blobs::rpc::proto::Request>,
>;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GossipTicket {
    pub topic_id: TopicId,
    pub node_id: NodeId,
}

impl GossipTicket {
    pub fn new(topic_id: TopicId, node_id: NodeId) -> Self {
        Self { topic_id, node_id }
    }
}

impl GossipTicket {
    fn from_bytes(bytes: &[u8]) -> Result<Self> {
        serde_json::from_slice(bytes).map_err(Into::into)
    }

    fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("Infallible")
    }
}

impl FromStr for GossipTicket {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self> {
        let bytes = data_encoding::BASE32
            .decode(s.as_bytes())
            .map_err(|_| anyhow::anyhow!("Invalid base32 string"))?;
        Self::from_bytes(&bytes)
    }
}

impl ToString for GossipTicket {
    fn to_string(&self) -> String {
        let mut text = data_encoding::BASE32.encode(&self.to_bytes());
        text.make_ascii_lowercase();
        text
    }
}

#[derive(Debug)]
pub struct GossipClient {
    pub client: Gossip,
    ticket: GossipTicket,
    channel: GossipChannel,
}

impl Deref for GossipClient {
    type Target = Gossip;

    fn deref(&self) -> &Self::Target {
        &self.client
    }
}

impl GossipClient {
    pub async fn new(gossip: Gossip, node_id: NodeId) -> Result<Self> {
        let topic_id = TopicId::from_bytes(rand::random());
        let ticket = GossipTicket::new(topic_id, node_id);
        let (sender, receiver) = gossip.subscribe(topic_id, vec![])?.split();
        let gossip_chan = GossipChannel {
            sender,
            receiver: Some(receiver),
        };

        Ok(Self {
            client: gossip,
            ticket,
            channel: gossip_chan,
        })
    }

    pub fn channel(&self) -> &GossipChannel {
        &self.channel
    }

    pub fn channel_mut(&mut self) -> &mut GossipChannel {
        &mut self.channel
    }

    pub fn ticket(&self) -> &GossipTicket {
        &self.ticket
    }
}

#[derive(Debug)]
pub struct GossipChannel {
    sender: GossipSender,
    receiver: Option<GossipReceiver>,
}

impl Deref for GossipChannel {
    type Target = GossipSender;

    fn deref(&self) -> &Self::Target {
        &self.sender
    }
}

impl GossipChannel {
    pub fn take_receiver(&mut self) -> Result<GossipReceiver> {
        self.receiver
            .take()
            .ok_or(anyhow::anyhow!("Receiver already taken"))
    }
}

#[derive(Debug)]
pub struct Iroh {
    #[allow(dead_code)]
    router: Router,
    pub blobs: BlobsClient,
    pub node_addr: NodeAddr,
    pub gossip: GossipClient,
}

impl Iroh {
    pub async fn new(path: PathBuf) -> Result<Self> {
        // create dir if it doesn't already exist
        tokio::fs::create_dir_all(&path).await?;

        // create endpoint
        let endpoint = iroh::Endpoint::builder().discovery_n0().bind().await?;

        // build the protocol router
        let mut builder = iroh::protocol::Router::builder(endpoint);

        // add iroh blobs
        let blobs = iroh_blobs::net_protocol::Blobs::persistent(&path)
            .await?
            .build(builder.endpoint());
        builder = builder.accept(iroh_blobs::ALPN, blobs.clone());

        // add iroh gossip
        let gossip = Gossip::builder().spawn(builder.endpoint().clone()).await?;
        builder = builder.accept(iroh_gossip::ALPN, gossip.clone());

        let node_addr = builder.endpoint().node_addr().await?;
        let router = builder.spawn().await?;
        let blobs = blobs.client().clone();
        let gossip = GossipClient::new(gossip, node_addr.node_id).await?;

        Ok(Self {
            node_addr,
            router,
            blobs,
            gossip,
        })
    }

    pub fn gossip(&self) -> &GossipClient {
        &self.gossip
    }

    pub fn blobs(&self) -> &BlobsClient {
        &self.blobs
    }

    #[allow(dead_code)]
    pub async fn shutdown(&self) -> Result<(), String> {
        self.router.shutdown().await.map_err(|e| e.to_string())
    }
}
