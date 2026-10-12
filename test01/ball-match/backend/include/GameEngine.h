#pragma once

#include <vector>
#include <string>
#include <random>
#include <set>
#include <map>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

enum class BallType {
    Basketball = 0,
    Soccer = 1,
    Tennis = 2,
    Baseball = 3,
    Volleyball = 4,
    PingPong = 5,
    Empty = -1
};

struct Position {
    int row;
    int col;
};

struct MatchResult {
    std::vector<Position> positions;
    BallType type;
    int length;
};

struct SpecialEffect {
    std::string name;
    std::string description;
    std::vector<Position> affected;
};

struct MoveResult {
    bool valid;
    int score;
    int combo;
    std::vector<std::vector<int>> board;
    std::vector<SpecialEffect> effects;
    std::vector<Position> matched;
};

class GameEngine {
public:
    GameEngine(int rows = 8, int cols = 8);

    void initBoard();
    json getBoardState() const;
    json swap(int r1, int c1, int r2, int c2);
    json getLeaderboard() const;
    void submitScore(const std::string& player, int score);
    int getScore() const { return score_; }

private:
    int rows_, cols_;
    std::vector<std::vector<BallType>> board_;
    std::mt19937 rng_;
    int score_;
    int combo_;
    std::map<std::string, int> leaderboard_;

    BallType randomBall();
    bool isMatch(int row, int col) const;
    std::vector<MatchResult> findAllMatches();
    void removeMatches(const std::vector<MatchResult>& matches, std::vector<SpecialEffect>& effects);
    void applyGravity();
    void fillEmpty();
    bool hasValidMoves();
    void processCascades(MoveResult& result);
    SpecialEffect triggerSpecial(const MatchResult& match);
    json boardToJson() const;
};
