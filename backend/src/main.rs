use std::net::SocketAddr;

use axum::http::{HeaderValue, Method};
use datedly::{
    api::{router, AppState, PublishCtx},
    jobs::Jobs,
    store::Store,
};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let data_dir = std::env::var("DATEDLY_DATA_DIR").unwrap_or_else(|_| "../data".into());
    let port: u16 = std::env::var("DATEDLY_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787);
    let origin =
        std::env::var("DATEDLY_ALLOWED_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".into());

    let store = Store::open(&data_dir)
        .await
        .expect("cannot open data directory");
    // Encrypted bundles: committed to Git, read by the scheduled publish job.
    let publish_dir =
        std::env::var("DATEDLY_PUBLISH_DIR").unwrap_or_else(|_| "../published".into());
    let publish = PublishCtx {
        data_dir: data_dir.clone().into(),
        publish_dir: publish_dir.into(),
    };

    let cors = CorsLayer::new()
        .allow_origin(
            origin
                .parse::<HeaderValue>()
                .expect("invalid DATEDLY_ALLOWED_ORIGIN"),
        )
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    let app = router(AppState {
        store,
        jobs: Jobs::default(),
        publish,
    })
    .layer(cors);

    // The studio API is local-only: it binds to loopback, never to the network.
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("Datedly studio API on http://{addr} (data: {data_dir})");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("port busy");
    axum::serve(listener, app).await.unwrap();
}
