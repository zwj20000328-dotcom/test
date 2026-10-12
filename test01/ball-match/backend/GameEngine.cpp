#include "GameEngine.h"
#include <algorithm>
#include <queue>

GameEngine::GameEngine(int rows, int cols)
    : rows_(rows), cols_(cols), score_(0), combo_(0), rng_(std::random_device{}()) {
    initBoard();
}

BallType GameEngine::randomBall() {
    std::uniform_int_distribution<int> dist(0, 5);
    return static_cast<BallType>(dist(rng_));
}

void GameEngine::initBoard() {
    board_.resize(rows_, std::vector<BallType>(cols_));
    for (int i = 0; i < rows_; ++i) {
        for (int j = 0; j < cols_; ++j) {
            do {
                board_[i][j] = randomBall();
            } while (isMatch(i, j));
        }
    }
}

bool GameEngine::isMatch(int row, int col) const {
    BallType type = board_[row][col];
    if (type == BallType::Empty) return false;

    if (col >= 2 && board_[row][col-1] == type && board_[row][col-2] == type)
        return true;
    if (row >= 2 && board_[row-1][col] == type && board_[row-2][col] == type)
        return true;
    return false;
}

std::vector<MatchResult> GameEngine::findAllMatches() {
    std::vector<MatchResult> matches;
    std::vector<std::vector<bool>> visited(rows_, std::vector<bool>(cols_, false));

    for (int i = 0; i < rows_; ++i) {
        for (int j = 0; j < cols_; ++j) {
            if (board_[i][j] == BallType::Empty) continue;

            int hLen = 1;
            while (j + hLen < cols_ && board_[i][j + hLen] == board_[i][j]) hLen++;
            if (hLen >= 3) {
                MatchResult m;
                m.type = board_[i][j];
                m.length = hLen;
                for (int k = 0; k < hLen; ++k)
                    m.positions.push_back({i, j + k});
                matches.push_back(m);
            }

            int vLen = 1;
            while (i + vLen < rows_ && board_[i + vLen][j] == board_[i][j]) vLen++;
            if (vLen >= 3) {
                MatchResult m;
                m.type = board_[i][j];
                m.length = vLen;
                for (int k = 0; k < vLen; ++k)
                    m.positions.push_back({i + k, j});
                matches.push_back(m);
            }
        }
    }
    return matches;
}

SpecialEffect GameEngine::triggerSpecial(const MatchResult& match) {
    SpecialEffect effect;
    effect.name = "";
    effect.description = "";

    if (match.length >= 5) {
        effect.name = "super_combo";
        effect.description = "超级连击！清除所有同类球";
        BallType type = match.type;
        for (int i = 0; i < rows_; ++i)
            for (int j = 0; j < cols_; ++j)
                if (board_[i][j] == type)
                    effect.affected.push_back({i, j});
    } else if (match.length == 4) {
        switch (match.type) {
            case BallType::Basketball:
                effect.name = "slam_dunk";
                effect.description = "扣篮！清除整行";
                for (int j = 0; j < cols_; ++j)
                    effect.affected.push_back({match.positions[0].row, j});
                break;
            case BallType::Soccer:
                effect.name = "goal_shot";
                effect.description = "射门！清除3x3区域";
                {
                    int cr = match.positions[1].row;
                    int cc = match.positions[1].col;
                    for (int dr = -1; dr <= 1; ++dr)
                        for (int dc = -1; dc <= 1; ++dc) {
                            int nr = cr + dr, nc = cc + dc;
                            if (nr >= 0 && nr < rows_ && nc >= 0 && nc < cols_)
                                effect.affected.push_back({nr, nc});
                        }
                }
                break;
            case BallType::Tennis:
                effect.name = "bounce";
                effect.description = "弹跳球！随机消除5个球";
                {
                    std::vector<Position> available;
                    for (int i = 0; i < rows_; ++i)
                        for (int j = 0; j < cols_; ++j)
                            if (board_[i][j] != BallType::Empty)
                                available.push_back({i, j});
                    std::shuffle(available.begin(), available.end(), rng_);
                    for (int k = 0; k < std::min(5, (int)available.size()); ++k)
                        effect.affected.push_back(available[k]);
                }
                break;
            case BallType::Baseball:
                effect.name = "home_run";
                effect.description = "全垒打！清除整列";
                for (int i = 0; i < rows_; ++i)
                    effect.affected.push_back({i, match.positions[0].col});
                break;
            case BallType::Volleyball:
                effect.name = "smash";
                effect.description = "扣杀！清除十字区域";
                {
                    int cr = match.positions[1].row;
                    int cc = match.positions[1].col;
                    for (int j = 0; j < cols_; ++j)
                        effect.affected.push_back({cr, j});
                    for (int i = 0; i < rows_; ++i)
                        if (i != cr) effect.affected.push_back({i, cc});
                }
                break;
            case BallType::PingPong:
                effect.name = "spin";
                effect.description = "旋转球！清除对角线";
                {
                    int cr = match.positions[1].row;
                    int cc = match.positions[1].col;
                    for (int d = -3; d <= 3; ++d) {
                        int nr1 = cr + d, nc1 = cc + d;
                        int nr2 = cr + d, nc2 = cc - d;
                        if (nr1 >= 0 && nr1 < rows_ && nc1 >= 0 && nc1 < cols_)
                            effect.affected.push_back({nr1, nc1});
                        if (nr2 >= 0 && nr2 < rows_ && nc2 >= 0 && nc2 < cols_ && nc2 != nc1)
                            effect.affected.push_back({nr2, nc2});
                    }
                }
                break;
            default:
                break;
        }
    }
    return effect;
}

void GameEngine::removeMatches(const std::vector<MatchResult>& matches, std::vector<SpecialEffect>& effects) {
    std::set<std::pair<int,int>> toRemove;

    for (const auto& m : matches) {
        for (const auto& p : m.positions)
            toRemove.insert({p.row, p.col});

        if (m.length >= 4) {
            SpecialEffect effect = triggerSpecial(m);
            if (!effect.name.empty()) {
                for (const auto& p : effect.affected)
                    toRemove.insert({p.row, p.col});
                effects.push_back(effect);
            }
        }
    }

    for (const auto& [r, c] : toRemove)
        board_[r][c] = BallType::Empty;
}

void GameEngine::applyGravity() {
    for (int j = 0; j < cols_; ++j) {
        int writeRow = rows_ - 1;
        for (int i = rows_ - 1; i >= 0; --i) {
            if (board_[i][j] != BallType::Empty) {
                board_[writeRow][j] = board_[i][j];
                if (writeRow != i) board_[i][j] = BallType::Empty;
                writeRow--;
            }
        }
    }
}

void GameEngine::fillEmpty() {
    for (int i = 0; i < rows_; ++i)
        for (int j = 0; j < cols_; ++j)
            if (board_[i][j] == BallType::Empty)
                board_[i][j] = randomBall();
}

void GameEngine::processCascades(MoveResult& result) {
    combo_ = 0;
    while (true) {
        auto matches = findAllMatches();
        if (matches.empty()) break;

        combo_++;
        result.combo = combo_;

        std::vector<SpecialEffect> effects;
        removeMatches(matches, effects);
        result.effects.insert(result.effects.end(), effects.begin(), effects.end());

        for (const auto& m : matches)
            for (const auto& p : m.positions)
                result.matched.push_back(p);

        int baseScore = 0;
        for (const auto& m : matches)
            baseScore += m.length * 10;
        result.score += baseScore * combo_;

        applyGravity();
        fillEmpty();
    }
    score_ += result.score;
}

json GameEngine::swap(int r1, int c1, int r2, int c2) {
    MoveResult result;
    result.valid = false;
    result.score = 0;
    result.combo = 0;

    if (r1 < 0 || r1 >= rows_ || c1 < 0 || c1 >= cols_ ||
        r2 < 0 || r2 >= rows_ || c2 < 0 || c2 >= cols_) {
        return {{"valid", false}, {"error", "out_of_bounds"}};
    }

    int dr = std::abs(r1 - r2), dc = std::abs(c1 - c2);
    if (dr + dc != 1) {
        return {{"valid", false}, {"error", "not_adjacent"}};
    }

    std::swap(board_[r1][c1], board_[r2][c2]);

    auto matches = findAllMatches();
    if (matches.empty()) {
        std::swap(board_[r1][c1], board_[r2][c2]);
        return {{"valid", false}, {"error", "no_match"}, {"board", boardToJson()}};
    }

    result.valid = true;
    processCascades(result);
    result.board = std::vector<std::vector<int>>(rows_, std::vector<int>(cols_));
    for (int i = 0; i < rows_; ++i)
        for (int j = 0; j < cols_; ++j)
            result.board[i][j] = static_cast<int>(board_[i][j]);

    json effectsJson = json::array();
    for (const auto& e : result.effects) {
        json eff;
        eff["name"] = e.name;
        eff["description"] = e.description;
        effectsJson.push_back(eff);
    }

    if (!hasValidMoves()) {
        initBoard();
    }

    return {
        {"valid", true},
        {"score", result.score},
        {"combo", result.combo},
        {"totalScore", score_},
        {"board", boardToJson()},
        {"effects", effectsJson}
    };
}

bool GameEngine::hasValidMoves() {
    for (int i = 0; i < rows_; ++i) {
        for (int j = 0; j < cols_; ++j) {
            if (j + 1 < cols_) {
                std::swap(board_[i][j], board_[i][j+1]);
                bool has = !findAllMatches().empty();
                std::swap(board_[i][j], board_[i][j+1]);
                if (has) return true;
            }
            if (i + 1 < rows_) {
                std::swap(board_[i][j], board_[i+1][j]);
                bool has = !findAllMatches().empty();
                std::swap(board_[i][j], board_[i+1][j]);
                if (has) return true;
            }
        }
    }
    return false;
}

json GameEngine::boardToJson() const {
    json arr = json::array();
    for (int i = 0; i < rows_; ++i) {
        json row = json::array();
        for (int j = 0; j < cols_; ++j)
            row.push_back(static_cast<int>(board_[i][j]));
        arr.push_back(row);
    }
    return arr;
}

json GameEngine::getBoardState() const {
    return {
        {"board", boardToJson()},
        {"score", score_},
        {"rows", rows_},
        {"cols", cols_}
    };
}

json GameEngine::getLeaderboard() const {
    json arr = json::array();
    std::vector<std::pair<std::string, int>> sorted(leaderboard_.begin(), leaderboard_.end());
    std::sort(sorted.begin(), sorted.end(),
              [](const auto& a, const auto& b) { return a.second > b.second; });
    for (const auto& [name, sc] : sorted) {
        if (arr.size() >= 10) break;
        arr.push_back({{"name", name}, {"score", sc}});
    }
    return arr;
}

void GameEngine::submitScore(const std::string& player, int score) {
    if (leaderboard_.find(player) == leaderboard_.end() || leaderboard_[player] < score)
        leaderboard_[player] = score;
}
