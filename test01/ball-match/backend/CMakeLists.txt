cmake_minimum_required(VERSION 3.14)
project(BallMatchServer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.15.3
)
FetchContent_MakeAvailable(httplib)

FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)

add_executable(BallMatchServer
    main.cpp
    GameEngine.cpp
)

target_include_directories(BallMatchServer PRIVATE include)
target_link_libraries(BallMatchServer PRIVATE httplib nlohmann_json::nlohmann_json)
