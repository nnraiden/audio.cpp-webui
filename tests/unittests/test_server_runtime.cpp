#include "config.h"
#include "http.h"
#include "runtime.h"

#include "engine/framework/io/json.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {

void require(bool condition, const std::string & message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

std::filesystem::path make_temp_root() {
    const auto root = std::filesystem::temp_directory_path() / "audiocpp_server_runtime_test";
    std::error_code ec;
    std::filesystem::remove_all(root, ec);
    std::filesystem::create_directories(root);
    return root;
}

std::filesystem::path write_text_file(
    const std::filesystem::path & path,
    const std::string & text) {
    std::filesystem::create_directories(path.parent_path());
    std::ofstream out(path, std::ios::binary);
    if (!out) {
        throw std::runtime_error("failed to create file: " + path.string());
    }
    out << text;
    if (!out) {
        throw std::runtime_error("failed to write file: " + path.string());
    }
    return path;
}

std::filesystem::path write_config(
    const std::filesystem::path & root,
    const std::string & name,
    const std::string & text) {
    return write_text_file(root / name, text);
}

void test_voices_endpoint_uses_shared_samples_and_model_presets() {
    const auto root = make_temp_root();
    const auto shared_dir = root / "voices" / "shared";
    const auto nested_shared_dir = shared_dir / "vibevoice";
    const auto model_dir = root / "models" / "pocket-tts";
    const auto embeddings_dir = model_dir / "embeddings";

    std::filesystem::create_directories(shared_dir);
    std::filesystem::create_directories(nested_shared_dir);
    std::filesystem::create_directories(embeddings_dir);
    write_text_file(shared_dir / "alice.wav", "RIFF");
    write_text_file(shared_dir / "alice.txt", "Alice transcript");
    write_text_file(shared_dir / "bob.WAV", "RIFF");
    write_text_file(nested_shared_dir / "speaker-01.wav", "RIFF");
    write_text_file(nested_shared_dir / "speaker-01.txt", "Nested transcript");
    write_text_file(shared_dir / "ignore.txt", "not audio");
    write_text_file(embeddings_dir / "marius.safetensors", "stub");

    const auto config_path = write_config(
        root,
        "server.json",
        R"JSON({
  "host": "127.0.0.1",
  "port": 8080,
  "backend": "cpu",
  "lazy_load": true,
  "voice_samples_base": "voices/shared",
  "models": [
    {
      "id": "tts",
      "family": "pocket_tts",
      "path": "models/pocket-tts",
      "voice_presets": {
        "narrator": {
          "voice_id": "cosette"
        }
      }
    }
  ]
})JSON");

    auto config = minitts::server::load_server_config(config_path);
    minitts::server::ServerState state(std::move(config), root);
    minitts::server::HttpRequest request;
    request.method = "GET";
    request.path = "/v1/audio/voices";
    request.query = "model=tts";
    const minitts::server::HttpResponse response = state.handle(request);

    require(response.status == 200, "voices endpoint should return 200");
    const auto payload = engine::io::json::parse(response.body);

    const auto & voices = payload.require("voices").as_array();
    require(voices.size() == 2, "voices should include preset id and embedding voice");
    require(voices[0].as_string() == "marius", "embedding voice should be listed");
    require(voices[1].as_string() == "narrator", "preset voice should be listed");

    const auto & presets = payload.require("presets").as_array();
    require(presets.size() == 1, "presets should remain model-specific");
    require(engine::io::json::require_string(presets[0], "id") == "narrator", "preset id should match config");
    require(engine::io::json::require_string(presets[0], "voice_id") == "cosette", "preset voice_id should match config");
    require(presets[0].require("voice_ref").is_null(), "voice_ref should be null for voice_id-only preset");
    require(presets[0].require("reference_text").is_null(), "reference_text should stay null when unset");

    const auto & samples = payload.require("samples").as_array();
    require(samples.size() == 3, "samples should come from shared voice_samples_base recursively");
    require(engine::io::json::require_string(samples[0], "id") == "alice", "first shared wav should be listed");
    require(engine::io::json::require_string(samples[0], "path") == (shared_dir / "alice.wav").string(), "first shared wav path should match");
    require(engine::io::json::require_string(samples[0], "transcript_text") == "Alice transcript", "sibling transcript text should be exposed");
    require(engine::io::json::require_string(samples[1], "id") == "bob", "wav scan should be case-insensitive");
    require(engine::io::json::require_string(samples[1], "path") == (shared_dir / "bob.WAV").string(), "second shared wav path should match");
    require(samples[1].require("transcript_text").is_null(), "missing sibling transcript should be null");
    require(engine::io::json::require_string(samples[2], "id") == "vibevoice/speaker-01", "nested shared wav should use a relative id");
    require(engine::io::json::require_string(samples[2], "path") == (nested_shared_dir / "speaker-01.wav").string(), "nested shared wav path should match");
    require(engine::io::json::require_string(samples[2], "transcript_text") == "Nested transcript", "nested sibling transcript should be exposed");
}

minitts::server::ServerState make_webui_state(const std::filesystem::path & root) {
    const auto webui_dir = root / "webui";
    write_text_file(webui_dir / "index.html", "<!doctype html><title>audiocpp</title>");
    write_text_file(webui_dir / "js" / "app.js", "console.log('audiocpp');");

    const auto config_path = write_config(
        root,
        "server_webui.json",
        R"JSON({
  "backend": "cpu",
  "lazy_load": true,
  "webui_root": "webui",
  "models": [
    {
      "id": "tts",
      "family": "pocket_tts",
      "path": "models/pocket-tts"
    }
  ]
})JSON");

    auto config = minitts::server::load_server_config(config_path);
    return minitts::server::ServerState(std::move(config), root);
}

void test_webui_root_serves_index_and_assets() {
    const auto root = make_temp_root();
    auto state = make_webui_state(root);

    minitts::server::HttpRequest root_request;
    root_request.method = "GET";
    root_request.path = "/";
    const auto root_response = state.handle(root_request);
    require(root_response.status == 200, "webui root should return 200");
    require(root_response.content_type == "text/html; charset=utf-8", "webui root should serve html");
    require(root_response.body.find("<title>audiocpp</title>") != std::string::npos, "webui root should serve index content");

    minitts::server::HttpRequest asset_request;
    asset_request.method = "GET";
    asset_request.path = "/js/app.js";
    const auto asset_response = state.handle(asset_request);
    require(asset_response.status == 200, "webui asset should return 200");
    require(asset_response.content_type == "text/javascript; charset=utf-8", "webui asset should use javascript content type");
    require(asset_response.body == "console.log('audiocpp');", "webui asset body should match file content");
}

void test_webui_root_spa_fallback_and_api_isolation() {
    const auto root = make_temp_root();
    auto state = make_webui_state(root);

    minitts::server::HttpRequest spa_request;
    spa_request.method = "GET";
    spa_request.path = "/tts/playground";
    const auto spa_response = state.handle(spa_request);
    require(spa_response.status == 200, "unknown non-api path should fall back to index");
    require(spa_response.content_type == "text/html; charset=utf-8", "spa fallback should serve html");

    minitts::server::HttpRequest missing_asset_request;
    missing_asset_request.method = "GET";
    missing_asset_request.path = "/js/missing.js";
    const auto missing_asset_response = state.handle(missing_asset_request);
    require(missing_asset_response.status == 404, "missing asset path should stay a 404");

    minitts::server::HttpRequest api_request;
    api_request.method = "GET";
    api_request.path = "/v1/does-not-exist";
    const auto api_response = state.handle(api_request);
    require(api_response.status == 404, "unknown api path should remain an api 404");
}

}  // namespace

int main() {
    try {
        test_voices_endpoint_uses_shared_samples_and_model_presets();
        test_webui_root_serves_index_and_assets();
        test_webui_root_spa_fallback_and_api_isolation();
    } catch (const std::exception & error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
    std::cout << "server_runtime_test passed\n";
    return 0;
}
