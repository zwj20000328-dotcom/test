#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <algorithm>
#include <fstream>
#include <map>
#include <cmath>
#include <functional>

#pragma comment(lib, "ws2_32.lib")

#define BOARD_SIZE 15
#define EMPTY 0
#define BLACK 1
#define WHITE 2

struct Move {
    int row, col;
};

class GomokuGame {
public:
    int board[BOARD_SIZE][BOARD_SIZE];
    int currentPlayer;
    bool gameOver;
    int winner;
    std::vector<Move> history;

    GomokuGame() { reset(); }

    void reset() {
        for (int i = 0; i < BOARD_SIZE; i++)
            for (int j = 0; j < BOARD_SIZE; j++)
                board[i][j] = EMPTY;
        currentPlayer = BLACK;
        gameOver = false;
        winner = 0;
        history.clear();
    }

    bool isValid(int r, int c) {
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] == EMPTY && !gameOver;
    }

    bool makeMove(int r, int c) {
        if (!isValid(r, c)) return false;
        board[r][c] = currentPlayer;
        history.push_back({r, c});
        if (checkWin(r, c, currentPlayer)) {
            gameOver = true;
            winner = currentPlayer;
        } else if (history.size() == BOARD_SIZE * BOARD_SIZE) {
            gameOver = true;
            winner = 0;
        } else {
            currentPlayer = (currentPlayer == BLACK) ? WHITE : BLACK;
        }
        return true;
    }

    bool checkWin(int r, int c, int player) {
        int dirs[4][2] = {{0,1},{1,0},{1,1},{1,-1}};
        for (auto& d : dirs) {
            int count = 1;
            for (int i = 1; i < 5; i++) {
                int nr = r + d[0]*i, nc = c + d[1]*i;
                if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && board[nr][nc]==player) count++;
                else break;
            }
            for (int i = 1; i < 5; i++) {
                int nr = r - d[0]*i, nc = c - d[1]*i;
                if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && board[nr][nc]==player) count++;
                else break;
            }
            if (count >= 5) return true;
        }
        return false;
    }

    std::string toJson() {
        std::ostringstream ss;
        ss << "{\"board\":[";
        for (int i = 0; i < BOARD_SIZE; i++) {
            if (i > 0) ss << ",";
            ss << "[";
            for (int j = 0; j < BOARD_SIZE; j++) {
                if (j > 0) ss << ",";
                ss << board[i][j];
            }
            ss << "]";
        }
        ss << "],\"currentPlayer\":" << currentPlayer
           << ",\"gameOver\":" << (gameOver ? "true" : "false")
           << ",\"winner\":" << winner
           << ",\"moveCount\":" << history.size() << "}";
        return ss.str();
    }
};

class GomokuAI {
public:
    static Move getBestMove(GomokuGame& game) {
        int aiPlayer = game.currentPlayer;
        int oppPlayer = (aiPlayer == BLACK) ? WHITE : BLACK;
        int bestScore = -1;
        Move bestMove = {-1, -1};

        std::vector<std::pair<int, std::pair<int,int>>> candidates;
        for (int i = 0; i < BOARD_SIZE; i++) {
            for (int j = 0; j < BOARD_SIZE; j++) {
                if (game.board[i][j] == EMPTY && hasNeighbor(game.board, i, j, 2)) {
                    int s = evaluatePosition(game.board, i, j, aiPlayer, oppPlayer);
                    candidates.push_back({s, {i, j}});
                }
            }
        }

        if (candidates.empty()) {
            return {BOARD_SIZE / 2, BOARD_SIZE / 2};
        }

        std::sort(candidates.begin(), candidates.end(),
            [](const auto& a, const auto& b) { return a.first > b.first; });

        bestScore = candidates[0].first;
        bestMove = {candidates[0].second.first, candidates[0].second.second};
        return bestMove;
    }

private:
    static bool hasNeighbor(int board[][BOARD_SIZE], int r, int c, int dist) {
        for (int i = r - dist; i <= r + dist; i++) {
            for (int j = c - dist; j <= c + dist; j++) {
                if (i >= 0 && i < BOARD_SIZE && j >= 0 && j < BOARD_SIZE) {
                    if (board[i][j] != EMPTY) return true;
                }
            }
        }
        return false;
    }

    static int evaluatePosition(int board[][BOARD_SIZE], int r, int c, int ai, int opp) {
        int attackScore = evaluateForPlayer(board, r, c, ai);
        int defenseScore = evaluateForPlayer(board, r, c, opp);
        return attackScore * 11 / 10 + defenseScore;
    }

    static int evaluateForPlayer(int board[][BOARD_SIZE], int r, int c, int player) {
        int totalScore = 0;
        int dirs[4][2] = {{0,1},{1,0},{1,1},{1,-1}};

        for (auto& d : dirs) {
            int count = 1;
            int openEnds = 0;
            int blocked = 0;

            int i = 1;
            while (i < 5) {
                int nr = r + d[0]*i, nc = c + d[1]*i;
                if (nr<0 || nr>=BOARD_SIZE || nc<0 || nc>=BOARD_SIZE) { blocked++; break; }
                if (board[nr][nc] == player) { count++; i++; }
                else if (board[nr][nc] == EMPTY) { openEnds++; break; }
                else { blocked++; break; }
            }
            if (i < 5 && !(r+d[0]*i<0||r+d[0]*i>=BOARD_SIZE||c+d[1]*i<0||c+d[1]*i>=BOARD_SIZE)) {}
            else if (i >= 5 || (r+d[0]*i<0||r+d[0]*i>=BOARD_SIZE||c+d[1]*i<0||c+d[1]*i>=BOARD_SIZE)) blocked++;

            i = 1;
            while (i < 5) {
                int nr = r - d[0]*i, nc = c - d[1]*i;
                if (nr<0 || nr>=BOARD_SIZE || nc<0 || nc>=BOARD_SIZE) { blocked++; break; }
                if (board[nr][nc] == player) { count++; i++; }
                else if (board[nr][nc] == EMPTY) { openEnds++; break; }
                else { blocked++; break; }
            }
            if (i < 5 && !(r-d[0]*i<0||r-d[0]*i>=BOARD_SIZE||c-d[1]*i<0||c-d[1]*i>=BOARD_SIZE)) {}
            else if (i >= 5 || (r-d[0]*i<0||r-d[0]*i>=BOARD_SIZE||c-d[1]*i<0||c-d[1]*i>=BOARD_SIZE)) blocked++;

            totalScore += getPatternScore(count, openEnds, blocked);
        }
        return totalScore;
    }

    static int getPatternScore(int count, int openEnds, int blocked) {
        if (count >= 5) return 1000000;
        if (blocked == 2) return 0;
        if (count == 4) {
            if (openEnds == 2) return 500000;
            if (openEnds == 1) return 50000;
        }
        if (count == 3) {
            if (openEnds == 2) return 10000;
            if (openEnds == 1) return 1000;
        }
        if (count == 2) {
            if (openEnds == 2) return 500;
            if (openEnds == 1) return 100;
        }
        if (count == 1) {
            if (openEnds == 2) return 10;
            if (openEnds == 1) return 1;
        }
        return 0;
    }
};

GomokuGame game;
bool vsAI = true;

std::string getMimeType(const std::string& path) {
    if (path.find(".html") != std::string::npos) return "text/html; charset=utf-8";
    if (path.find(".css") != std::string::npos) return "text/css";
    if (path.find(".js") != std::string::npos) return "application/javascript";
    if (path.find(".json") != std::string::npos) return "application/json";
    if (path.find(".png") != std::string::npos) return "image/png";
    if (path.find(".jpg") != std::string::npos || path.find(".jpeg") != std::string::npos) return "image/jpeg";
    if (path.find(".svg") != std::string::npos) return "image/svg+xml";
    if (path.find(".ico") != std::string::npos) return "image/x-icon";
    if (path.find(".woff") != std::string::npos) return "font/woff";
    if (path.find(".woff2") != std::string::npos) return "font/woff2";
    return "application/octet-stream";
}

std::string jsonResponse(const std::string& body, int code = 200) {
    std::ostringstream ss;
    ss << "HTTP/1.1 " << code << " OK\r\n"
       << "Content-Type: application/json; charset=utf-8\r\n"
       << "Access-Control-Allow-Origin: *\r\n"
       << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
       << "Access-Control-Allow-Headers: Content-Type\r\n"
       << "Content-Length: " << body.size() << "\r\n"
       << "Connection: close\r\n\r\n" << body;
    return ss.str();
}

std::string fileResponse(const std::string& body, const std::string& mimeType, int code = 200) {
    std::ostringstream ss;
    ss << "HTTP/1.1 " << code << " OK\r\n"
       << "Content-Type: " << mimeType << "\r\n"
       << "Content-Length: " << body.size() << "\r\n"
       << "Connection: close\r\n\r\n" << body;
    return ss.str();
}

std::string readFile(const std::string& path) {
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) return "";
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

std::string parseJsonField(const std::string& body, const std::string& field) {
    std::string key = "\"" + field + "\"";
    size_t pos = body.find(key);
    if (pos == std::string::npos) return "";
    pos = body.find(":", pos + key.size());
    if (pos == std::string::npos) return "";
    pos++;
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) pos++;
    size_t end = pos;
    while (end < body.size() && body[end] != ',' && body[end] != '}' && body[end] != ' '
           && body[end] != '\r' && body[end] != '\n') end++;
    return body.substr(pos, end - pos);
}

void handleClient(SOCKET clientSocket) {
    char buffer[8192];
    int received = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
    if (received <= 0) { closesocket(clientSocket); return; }
    buffer[received] = '\0';

    std::string request(buffer);
    std::string method, path, body;

    std::istringstream ss(request);
    ss >> method >> path;

    size_t bodyStart = request.find("\r\n\r\n");
    if (bodyStart != std::string::npos) {
        body = request.substr(bodyStart + 4);
    }

    if (method == "OPTIONS") {
        std::string resp = "HTTP/1.1 204 No Content\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Content-Type\r\n"
            "Connection: close\r\n\r\n";
        send(clientSocket, resp.c_str(), resp.size(), 0);
        closesocket(clientSocket);
        return;
    }

    if (path == "/api/state" && method == "GET") {
        std::string resp = jsonResponse(game.toJson());
        send(clientSocket, resp.c_str(), resp.size(), 0);
    }
    else if (path == "/api/move" && method == "POST") {
        int row = std::stoi(parseJsonField(body, "row"));
        int col = std::stoi(parseJsonField(body, "col"));

        if (game.makeMove(row, col)) {
            if (vsAI && !game.gameOver && game.currentPlayer == WHITE) {
                Move aiMove = GomokuAI::getBestMove(game);
                if (aiMove.row >= 0) {
                    game.makeMove(aiMove.row, aiMove.col);
                }
            }
            std::string resp = jsonResponse(game.toJson());
            send(clientSocket, resp.c_str(), resp.size(), 0);
        } else {
            std::string resp = jsonResponse("{\"error\":\"invalid move\"}", 400);
            send(clientSocket, resp.c_str(), resp.size(), 0);
        }
    }
    else if (path == "/api/reset" && method == "POST") {
        game.reset();
        std::string resp = jsonResponse(game.toJson());
        send(clientSocket, resp.c_str(), resp.size(), 0);
    }
    else if (path == "/api/mode" && method == "POST") {
        std::string mode = parseJsonField(body, "mode");
        vsAI = (mode == "ai");
        game.reset();
        std::string resp = jsonResponse("{\"mode\":\"" + std::string(vsAI ? "ai" : "pvp") + "\"}");
        send(clientSocket, resp.c_str(), resp.size(), 0);
    }
    else if (path == "/api/undo" && method == "POST") {
        if (!game.history.empty() && !game.gameOver) {
            int undoCount = vsAI ? 2 : 1;
            for (int u = 0; u < undoCount && !game.history.empty(); u++) {
                Move last = game.history.back();
                game.board[last.row][last.col] = EMPTY;
                game.history.pop_back();
                game.currentPlayer = (game.currentPlayer == BLACK) ? WHITE : BLACK;
            }
        }
        std::string resp = jsonResponse(game.toJson());
        send(clientSocket, resp.c_str(), resp.size(), 0);
    }
    else {
        std::string filePath = "." + path;
        if (path == "/") filePath = "./index.html";

        std::string content = readFile("dist" + filePath);
        if (content.empty()) {
            content = readFile("dist/index.html");
            if (content.empty()) {
                std::string resp = fileResponse("<h1>404 Not Found</h1>", "text/html", 404);
                send(clientSocket, resp.c_str(), resp.size(), 0);
            } else {
                std::string resp = fileResponse(content, "text/html; charset=utf-8");
                send(clientSocket, resp.c_str(), resp.size(), 0);
            }
        } else {
            std::string resp = fileResponse(content, getMimeType(filePath));
            send(clientSocket, resp.c_str(), resp.size(), 0);
        }
    }

    closesocket(clientSocket);
}

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) port = std::atoi(argv[1]);

    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "WSAStartup failed" << std::endl;
        return 1;
    }

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket == INVALID_SOCKET) {
        std::cerr << "Socket creation failed" << std::endl;
        WSACleanup();
        return 1;
    }

    int opt = 1;
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));

    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);

    if (bind(serverSocket, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "Bind failed" << std::endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "Listen failed" << std::endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    std::cout << "=======================================" << std::endl;
    std::cout << "  Gomoku Server running on port " << port << std::endl;
    std::cout << "  Open http://localhost:" << port << std::endl;
    std::cout << "=======================================" << std::endl;

    while (true) {
        sockaddr_in clientAddr;
        int addrLen = sizeof(clientAddr);
        SOCKET clientSocket = accept(serverSocket, (sockaddr*)&clientAddr, &addrLen);
        if (clientSocket == INVALID_SOCKET) continue;
        handleClient(clientSocket);
    }

    closesocket(serverSocket);
    WSACleanup();
    return 0;
}
