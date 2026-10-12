#include <httplib.h>
#include <nlohmann/json.hpp>
#include "GameEngine.h"
#include <iostream>
#include <mutex>
#include <map>

using json = nlohmann::json;

static std::map<std::string, GameEngine> sessions;
static std::mutex sessionMutex;

std::string generateSessionId() {
    static int counter = 0;
    return "session_" + std::to_string(++counter);
}

int main() {
    httplib::Server svr;

    svr.set_default_headers({
        {"Access-Control-Allow-Origin", "*"},
        {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type"}
    });

    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    svr.Post("/api/new-game", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(sessionMutex);
        int rows = 8, cols = 8;
        try {
            auto body = json::parse(req.body);
            if (body.contains("rows")) rows = body["rows"].get<int>();
            if (body.contains("cols")) cols = body["cols"].get<int>();
        } catch (...) {}

        std::string sid = generateSessionId();
        sessions.emplace(sid, GameEngine(rows, cols));

        json response = sessions[sid].getBoardState();
        response["sessionId"] = sid;
        res.set_content(response.dump(), "application/json");
    });

    svr.Post("/api/swap", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            std::string sid = body["sessionId"].get<std::string>();
            int r1 = body["r1"].get<int>();
            int c1 = body["c1"].get<int>();
            int r2 = body["r2"].get<int>();
            int c2 = body["c2"].get<int>();

            std::lock_guard<std::mutex> lock(sessionMutex);
            auto it = sessions.find(sid);
            if (it == sessions.end()) {
                res.status = 404;
                res.set_content(R"({"error":"session_not_found"})", "application/json");
                return;
            }

            json result = it->second.swap(r1, c1, r2, c2);
            res.set_content(result.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(json({{"error", e.what()}}).dump(), "application/json");
        }
    });

    svr.Get("/api/state/:sid", [](const httplib::Request& req, httplib::Response& res) {
        std::string sid = req.path_params.at("sid");
        std::lock_guard<std::mutex> lock(sessionMutex);
        auto it = sessions.find(sid);
        if (it == sessions.end()) {
            res.status = 404;
            res.set_content(R"({"error":"session_not_found"})", "application/json");
            return;
        }
        res.set_content(it->second.getBoardState().dump(), "application/json");
    });

    svr.Post("/api/score", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            std::string sid = body["sessionId"].get<std::string>();
            std::string player = body.value("player", "anonymous");

            std::lock_guard<std::mutex> lock(sessionMutex);
            auto it = sessions.find(sid);
            if (it == sessions.end()) {
                res.status = 404;
                res.set_content(R"({"error":"session_not_found"})", "application/json");
                return;
            }

            it->second.submitScore(player, it->second.getScore());
            res.set_content(json({{"status", "ok"}}).dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(json({{"error", e.what()}}).dump(), "application/json");
        }
    });

    svr.Get("/api/leaderboard", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(sessionMutex);
        json lb = json::array();
        std::map<std::string, int> allScores;
        for (auto& [sid, engine] : sessions) {
            auto board = engine.getLeaderboard();
            for (auto& entry : board) {
                std::string name = entry["name"].get<std::string>();
                int score = entry["score"].get<int>();
                if (allScores.find(name) == allScores.end() || allScores[name] < score)
                    allScores[name] = score;
            }
        }
        std::vector<std::pair<std::string, int>> sorted(allScores.begin(), allScores.end());
        std::sort(sorted.begin(), sorted.end(),
                  [](const auto& a, const auto& b) { return a.second > b.second; });
        for (const auto& [name, score] : sorted) {
            if (lb.size() >= 10) break;
            lb.push_back({{"name", name}, {"score", score}});
        }
        res.set_content(lb.dump(), "application/json");
    });

    std::cout << "Ball Match Server running on http://localhost:8080" << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}
