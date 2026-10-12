#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <commctrl.h>
#include <commdlg.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <map>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <ctime>
#include <cctype>

#ifdef _MSC_VER
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "winhttp.lib")
#pragma comment(linker,"\"/manifestdependency:type='win32' \
name='Microsoft.Windows.Common-Controls' version='6.0.0.0' \
processorArchitecture='*' publicKeyToken='6595b641444535fc' language='*'\"")
#endif

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────
struct Theme {
    COLORREF sidebarBg    = RGB(30, 30, 46);
    COLORREF sidebarText  = RGB(205, 214, 244);
    COLORREF sidebarHover = RGB(49, 50, 68);
    COLORREF toolbarBg    = RGB(255, 255, 255);
    COLORREF toolbarBdr   = RGB(224, 224, 224);
    COLORREF dashBg       = RGB(239, 243, 248);
    COLORREF cardBg       = RGB(255, 255, 255);
    COLORREF cardBorder   = RGB(218, 223, 232);
    COLORREF textPrimary  = RGB(30, 30, 46);
    COLORREF textSecondary= RGB(108, 112, 134);
    COLORREF accent       = RGB(59, 130, 246);
    COLORREF accentLight  = RGB(219, 234, 254);
    COLORREF editorBg     = RGB(255, 255, 255);
    COLORREF statusBg     = RGB(30, 30, 46);
    COLORREF statusText   = RGB(168, 171, 188);
    COLORREF weatherBg    = RGB(59, 130, 246);
    COLORREF weatherText  = RGB(255, 255, 255);
    COLORREF newsAccent   = RGB(220, 38, 38);
    COLORREF tipBg        = RGB(254, 249, 195);
    COLORREF tipBorder    = RGB(250, 204, 21);
    COLORREF sysBg        = RGB(240, 253, 244);
    COLORREF sysBorder    = RGB(34, 197, 94);
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
static const wchar_t* CLASS_NAME   = L"WorkNotesProMain";
static const wchar_t* WINDOW_TITLE = L"WorkNotes Pro - Professional Note Management";

static const int SIDEBAR_W    = 240;
static const int TOOLBAR_H    = 42;
static const int STATUSBAR_H  = 28;
static const int TITLE_H      = 34;
static const int HOVER_TIMER  = 999;
static const int HOVER_INTERVAL = 80;
static const int CLOCK_TIMER  = 1001;
static const int CLOCK_INTERVAL = 1000;

enum CtrlID {
    IDC_SIDEBAR = 100,
    IDC_TREEVIEW,
    IDC_EDITOR_CONTAINER,
    IDC_TITLE_EDIT,
    IDC_NOTE_EDITOR,
    IDC_STATUSBAR,
    IDC_TOOLBAR,
    IDC_BTN_NEW,
    IDC_BTN_SAVE,
    IDC_BTN_OPEN,
    IDC_BTN_BOLD,
    IDC_BTN_ITALIC,
    IDC_BTN_UNDERLINE,

    IDC_EBOOK_FRAME = 200,
    IDC_EBOOK_TEXT,
    IDC_BTN_EB_LOAD,
    IDC_BTN_EB_PREV,
    IDC_BTN_EB_NEXT,

    IDC_EXAM_FRAME = 300,
    IDC_EXAM_QUESTION,
    IDC_EXAM_OPT_A,
    IDC_EXAM_OPT_B,
    IDC_EXAM_OPT_C,
    IDC_EXAM_OPT_D,
    IDC_BTN_EX_LOAD,
    IDC_BTN_EX_SUBMIT,
    IDC_BTN_EX_RESET,
    IDC_BTN_EX_PREV,
    IDC_BTN_EX_NEXT,

    IDC_DASH_FRAME = 400,
    IDC_DASH_GREETING,
    IDC_DASH_DATE,
    IDC_DASH_TIME,
    IDC_DASH_WEATHER_ICON,
    IDC_DASH_WEATHER_TEMP,
    IDC_DASH_WEATHER_DESC,
    IDC_DASH_WEATHER_CITY,
    IDC_DASH_NEWS_TITLE,
    IDC_DASH_NEWS_1,
    IDC_DASH_NEWS_2,
    IDC_DASH_NEWS_3,
    IDC_DASH_NEWS_4,
    IDC_DASH_NEWS_5,
    IDC_DASH_NEWS_6,
    IDC_DASH_TIP_TITLE,
    IDC_DASH_TIP_TEXT,
    IDC_DASH_SYS_TITLE,
    IDC_DASH_SYS_TEXT,
    IDC_DASH_QUOTE,

    IDM_FILE_NEW = 1000,
    IDM_FILE_OPEN,
    IDM_FILE_SAVE,
    IDM_FILE_EXIT,
    IDM_EDIT_UNDO,
    IDM_EDIT_CUT,
    IDM_EDIT_COPY,
    IDM_EDIT_PASTE,
    IDM_VIEW_SIDEBAR,
    IDM_VIEW_FULLSCREEN,
    IDM_VIEW_DASHBOARD,
    IDM_TOOLS_WORDCOUNT,
    IDM_TOOLS_DATETIME,
    IDM_TOOLS_SETTINGS,
    IDM_HELP_ABOUT,
    IDM_HELP_WEATHER,
    IDM_HELP_NEWS,
};

enum PanelType { PANEL_NONE = 0, PANEL_EBOOK = 1, PANEL_EXAM = 2 };
enum ViewMode { VIEW_DASHBOARD = 0, VIEW_EDITOR = 1, VIEW_PANEL = 2 };

// ─────────────────────────────────────────────────────────────────────────────
// JSON Parser
// ─────────────────────────────────────────────────────────────────────────────
struct JsonValue {
    enum Type { JNULL, JBOOL, JNUMBER, JSTRING, JARRAY, JOBJECT };
    Type type = JNULL;
    std::wstring str;
    double num = 0;
    bool boolean = false;
    std::vector<JsonValue> arr;
    std::vector<std::pair<std::wstring, JsonValue>> obj;

    const JsonValue& operator[](const std::wstring& key) const {
        static JsonValue null_val;
        for (auto& p : obj) if (p.first == key) return p.second;
        return null_val;
    }
    const JsonValue& operator[](size_t i) const {
        static JsonValue null_val;
        return i < arr.size() ? arr[i] : null_val;
    }
    size_t size() const { return type == JARRAY ? arr.size() : obj.size(); }
};

class JsonParser {
    std::wstring s;
    size_t p;
    void ws() { while (p < s.size() && std::iswspace(s[p])) p++; }
    std::wstring parseStr() {
        if (s[p] != L'"') return {};
        p++;
        std::wstring r;
        while (p < s.size() && s[p] != L'"') {
            if (s[p] == L'\\') {
                p++;
                if (p >= s.size()) break;
                switch (s[p]) {
                    case L'"':  r += L'"'; break;
                    case L'\\': r += L'\\'; break;
                    case L'/':  r += L'/'; break;
                    case L'n':  r += L'\n'; break;
                    case L't':  r += L'\t'; break;
                    case L'r':  r += L'\r'; break;
                    default:    r += s[p]; break;
                }
            } else {
                r += s[p];
            }
            p++;
        }
        if (p < s.size()) p++;
        return r;
    }
    JsonValue parseVal() {
        ws();
        if (p >= s.size()) return {};
        if (s[p] == L'"') { JsonValue v; v.type = JsonValue::JSTRING; v.str = parseStr(); return v; }
        if (s[p] == L'{') return parseObj();
        if (s[p] == L'[') return parseArr();
        if (s[p] == L't' || s[p] == L'f') {
            JsonValue v; v.type = JsonValue::JBOOL; v.boolean = (s[p] == L't');
            while (p < s.size() && std::iswalpha(s[p])) p++;
            return v;
        }
        if (s[p] == L'n') { while (p < s.size() && std::iswalpha(s[p])) p++; return {}; }
        JsonValue v; v.type = JsonValue::JNUMBER;
        size_t start = p;
        if (s[p] == L'-') p++;
        while (p < s.size() && (std::iswdigit(s[p]) || s[p] == L'.' || s[p] == L'e' || s[p] == L'E' || s[p] == L'+' || s[p] == L'-')) {
            if (p > start && (s[p] == L'+' || s[p] == L'-') && s[p-1] != L'e' && s[p-1] != L'E') break;
            p++;
        }
        v.num = std::stod(s.substr(start, p - start));
        return v;
    }
    JsonValue parseObj() {
        JsonValue v; v.type = JsonValue::JOBJECT; p++; ws();
        while (p < s.size() && s[p] != L'}') {
            ws(); std::wstring key = parseStr(); ws();
            if (p < s.size() && s[p] == L':') p++;
            ws(); v.obj.push_back({key, parseVal()}); ws();
            if (p < s.size() && s[p] == L',') p++;
        }
        if (p < s.size()) p++;
        return v;
    }
    JsonValue parseArr() {
        JsonValue v; v.type = JsonValue::JARRAY; p++; ws();
        while (p < s.size() && s[p] != L']') {
            v.arr.push_back(parseVal()); ws();
            if (p < s.size() && s[p] == L',') p++; ws();
        }
        if (p < s.size()) p++;
        return v;
    }
public:
    JsonValue parse(const std::wstring& input) { s = input; p = 0; return parseVal(); }
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Structures
// ─────────────────────────────────────────────────────────────────────────────
struct Question {
    std::wstring text;
    std::vector<std::wstring> options;
    wchar_t answer = L'A';
};

struct WeatherInfo {
    std::wstring city;
    int tempC = 0;
    int humidity = 0;
    int windKph = 0;
    std::wstring desc;
    std::wstring icon;
    bool isMock = true;
};

struct NewsItem {
    std::wstring title;
    std::wstring category;
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────
std::wstring ReadFileUTF8(const wchar_t* path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return {};
    std::string bytes((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    size_t start = 0;
    if (bytes.size() >= 3 &&
        (unsigned char)bytes[0] == 0xEF &&
        (unsigned char)bytes[1] == 0xBB &&
        (unsigned char)bytes[2] == 0xBF) start = 3;
    int len = MultiByteToWideChar(CP_UTF8, 0, bytes.c_str() + start,
                                  (int)(bytes.size() - start), nullptr, 0);
    if (len <= 0) return {};
    std::wstring r(len, 0);
    MultiByteToWideChar(CP_UTF8, 0, bytes.c_str() + start,
                        (int)(bytes.size() - start), &r[0], len);
    return r;
}

bool WriteFileUTF8(const wchar_t* path, const std::wstring& content) {
    int len = WideCharToMultiByte(CP_UTF8, 0, content.c_str(), (int)content.size(),
                                  nullptr, 0, nullptr, nullptr);
    std::string bytes(len, 0);
    WideCharToMultiByte(CP_UTF8, 0, content.c_str(), (int)content.size(),
                        &bytes[0], len, nullptr, nullptr);
    std::ofstream f(path, std::ios::binary);
    if (!f) return false;
    f.write(bytes.c_str(), bytes.size());
    return true;
}

std::string WStringToUTF8(const std::wstring& ws) {
    int len = WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), (int)ws.size(), nullptr, 0, nullptr, nullptr);
    std::string s(len, 0);
    WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), (int)ws.size(), &s[0], len, nullptr, nullptr);
    return s;
}

std::wstring UTF8ToWString(const std::string& s) {
    int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    if (len <= 0) return {};
    std::wstring ws(len, 0);
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &ws[0], len);
    return ws;
}

HFONT MakeFont(const wchar_t* family, int pt, HWND ref, bool bold = false, bool italic = false) {
    HDC hdc = GetDC(ref);
    int h = -MulDiv(pt, GetDeviceCaps(hdc, LOGPIXELSY), 72);
    ReleaseDC(ref, hdc);
    return CreateFontW(h, 0, 0, 0, bold ? FW_BOLD : FW_NORMAL,
                       italic, FALSE, FALSE, DEFAULT_CHARSET,
                       OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                       CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, family);
}

std::wstring OpenFileDialog(HWND owner, const wchar_t* filter) {
    wchar_t path[MAX_PATH] = {};
    OPENFILENAMEW ofn = {};
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = owner;
    ofn.lpstrFilter = filter;
    ofn.lpstrFile = path;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST;
    return GetOpenFileNameW(&ofn) ? std::wstring(path) : std::wstring();
}

std::wstring SaveFileDialog(HWND owner, const wchar_t* filter) {
    wchar_t path[MAX_PATH] = {};
    OPENFILENAMEW ofn = {};
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = owner;
    ofn.lpstrFilter = filter;
    ofn.lpstrFile = path;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_OVERWRITEPROMPT;
    return GetSaveFileNameW(&ofn) ? std::wstring(path) : std::wstring();
}

std::wstring HttpGet(const wchar_t* host, const wchar_t* path, DWORD timeout = 5000) {
    std::string result;
    HINTERNET hSession = WinHttpOpen(L"WorkNotesPro/3.0",
                                      WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                      WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!hSession) return {};

    WinHttpSetTimeouts(hSession, timeout, timeout, timeout, timeout);

    HINTERNET hConnect = WinHttpConnect(hSession, host, INTERNET_DEFAULT_HTTPS_PORT, 0);
    if (!hConnect) { WinHttpCloseHandle(hSession); return {}; }

    HINTERNET hReq = WinHttpOpenRequest(hConnect, L"GET", path,
                                         nullptr, WINHTTP_NO_REFERER,
                                         WINHTTP_DEFAULT_ACCEPT_TYPES,
                                         WINHTTP_FLAG_SECURE);
    if (!hReq) { WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession); return {}; }

    if (!WinHttpSendRequest(hReq, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0) ||
        !WinHttpReceiveResponse(hReq, nullptr)) {
        WinHttpCloseHandle(hReq); WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession);
        return {};
    }

    DWORD bytesRead = 0;
    char buf[4096];
    for (;;) {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(hReq, &available) || available == 0) break;
        DWORD toRead = std::min(available, (DWORD)sizeof(buf));
        if (!WinHttpReadData(hReq, buf, toRead, &bytesRead) || bytesRead == 0) break;
        result.append(buf, bytesRead);
    }

    WinHttpCloseHandle(hReq);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);
    return UTF8ToWString(result);
}

std::wstring GetAppDirectory() {
    wchar_t path[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, path, MAX_PATH);
    std::wstring s(path);
    size_t pos = s.find_last_of(L"\\/");
    return (pos != std::wstring::npos) ? s.substr(0, pos + 1) : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────
static int DayHash() {
    time_t now = time(nullptr);
    tm t; localtime_s(&t, &now);
    return (t.tm_year * 367 + t.tm_yday * 31 + t.tm_mday * 7) & 0x7FFFFFFF;
}

WeatherInfo GetMockWeather(const std::wstring& city) {
    int h = DayHash();
    struct CityBase { const wchar_t* name; int baseTemp; int range; };
    static const CityBase cities[] = {
        {L"Beijing", 18, 20}, {L"Shanghai", 22, 16}, {L"Shenzhen", 26, 10},
        {L"Guangzhou", 25, 12}, {L"Chengdu", 20, 15}, {L"Hangzhou", 21, 17},
        {L"Nanjing", 19, 18}, {L"Wuhan", 20, 18}, {L"Xian", 17, 20},
        {L"Tokyo", 19, 16}, {L"New York", 15, 22}, {L"London", 12, 14},
        {L"Singapore", 30, 4}, {L"Sydney", 20, 12}, {L"Moscow", 5, 25},
    };
    static const wchar_t* descs[] = {
        L"Sunny", L"Partly Cloudy", L"Cloudy", L"Overcast",
        L"Light Rain", L"Moderate Rain", L"Thunderstorm",
        L"Light Snow", L"Foggy", L"Clear", L"Windy", L"Haze",
    };
    static const wchar_t* icons[] = {
        L"\u2600", L"\u26C5", L"\u2601", L"\u2601",
        L"\U0001F327", L"\U0001F327", L"\u26C8",
        L"\u2744", L"\U0001F32B", L"\u2600", L"\U0001F4A8", L"\U0001F32B",
    };

    int ci = h % 15;
    WeatherInfo w;
    w.city = city.empty() ? cities[ci].name : city;
    w.tempC = cities[ci].baseTemp + (h % cities[ci].range) - cities[ci].range / 2;
    w.humidity = 30 + (h % 60);
    w.windKph = 3 + (h % 30);
    int di = (h / 7) % 12;
    w.desc = descs[di];
    w.icon = icons[di];
    w.isMock = true;
    return w;
}

WeatherInfo FetchWeather(const std::wstring& city) {
    std::wstring path = L"/" + city + L"?format=j1";
    std::wstring resp = HttpGet(L"wttr.in", path.c_str());
    if (resp.empty()) return GetMockWeather(city);

    try {
        JsonParser parser;
        JsonValue root = parser.parse(resp);
        const JsonValue& current = root[L"current_condition"][0];
        if (current.type == JsonValue::JNULL) return GetMockWeather(city);

        WeatherInfo w;
        w.city = city;
        w.tempC = (int)current[L"temp_C"].num;
        w.humidity = (int)current[L"humidity"].num;
        w.windKph = (int)current[L"windspeedKmph"].num;
        w.desc = current[L"weatherDesc"][0][L"value"].str;
        int code = (int)current[L"weatherCode"].num;
        if (code == 113) { w.icon = L"\u2600"; }
        else if (code == 116) { w.icon = L"\u26C5"; }
        else if (code == 119 || code == 122) { w.icon = L"\u2601"; }
        else if (code >= 176 && code <= 395) { w.icon = L"\U0001F327"; }
        else if (code >= 320 && code <= 395) { w.icon = L"\u2744"; }
        else { w.icon = L"\u26C5"; }
        w.isMock = false;
        return w;
    } catch (...) {
        return GetMockWeather(city);
    }
}

std::vector<NewsItem> GetMockNews() {
    static const NewsItem pool[] = {
        {L"State Council releases new policies to boost digital economy growth", L"Policy"},
        {L"China's GDP grows 5.2% year-on-year in latest quarter", L"Economy"},
        {L"Breakthrough in quantum computing achieved by Chinese research team", L"Tech"},
        {L"New high-speed rail line connecting western provinces opens", L"Infrastructure"},
        {L"Global climate summit reaches landmark agreement on emissions", L"World"},
        {L"Shanghai Stock Exchange sees strongest rally in six months", L"Finance"},
        {L"AI-powered medical diagnosis system approved for clinical use", L"Health"},
        {L"China launches new satellite constellation for global broadband", L"Tech"},
        {L"Education Ministry announces curriculum reform for 2026", L"Education"},
        {L"Electric vehicle exports surge 40% compared to last year", L"Industry"},
        {L"New free trade zone established in Hainan province", L"Policy"},
        {L"International space station receives Chinese module upgrade", L"Science"},
        {L"Central Bank maintains interest rates amid stable inflation", L"Finance"},
        {L"Major archaeological discovery in Shaanxi reveals ancient city", L"Culture"},
        {L"5G coverage reaches 95% of urban areas nationwide", L"Tech"},
        {L"Renewable energy capacity exceeds coal for the first time", L"Energy"},
        {L"New international airport terminal begins operations", L"Infrastructure"},
        {L"National health insurance expands coverage for rare diseases", L"Health"},
        {L"Trade volume with ASEAN countries reaches record high", L"Economy"},
        {L"Smart city pilot program shows significant efficiency gains", L"Tech"},
        {L"Ministry of Transport announces new expressway network plan", L"Infrastructure"},
        {L"Chinese athletes win multiple medals at international championship", L"Sports"},
        {L"New regulations strengthen data privacy protection", L"Policy"},
        {L"Agricultural output increases with smart farming technology", L"Agriculture"},
        {L"Cross-border e-commerce platform launches in pilot cities", L"Economy"},
        {L"National museum opens exhibition on ancient Silk Road artifacts", L"Culture"},
        {L"Tech companies invest heavily in next-generation chip manufacturing", L"Tech"},
        {L"Urban green space expansion improves air quality metrics", L"Environment"},
        {L"New vocational training programs aim to close skills gap", L"Education"},
        {L"High-altitude railway project enters final construction phase", L"Infrastructure"},
    };
    int h = DayHash();
    int count = 6;
    std::vector<NewsItem> result;
    for (int i = 0; i < count; i++) {
        result.push_back(pool[(h + i * 5) % 30]);
    }
    return result;
}

std::vector<NewsItem> FetchNews() {
    std::wstring resp = HttpGet(L"feeds.bbci.co.uk", L"/news/world/rss.xml");
    if (resp.empty()) return GetMockNews();

    std::vector<NewsItem> items;
    size_t pos = 0;
    int skipFirst = 1;
    while (items.size() < 6) {
        size_t start = resp.find(L"<title>", pos);
        if (start == std::wstring::npos) break;
        start += 7;
        size_t end = resp.find(L"</title>", start);
        if (end == std::wstring::npos) break;
        std::wstring title = resp.substr(start, end - start);
        pos = end + 8;
        if (skipFirst > 0) { skipFirst--; continue; }
        NewsItem item;
        item.title = title;
        item.category = L"World";
        items.push_back(item);
    }
    if (items.empty()) return GetMockNews();
    return items;
}

std::wstring GetProductivityTip() {
    static const wchar_t* tips[] = {
        L"Use the Pomodoro Technique: work 25 minutes, then take a 5-minute break to maintain focus.",
        L"Start your day by identifying the 3 most important tasks. Complete them before anything else.",
        L"Keep your workspace organized. A clean desk leads to a clear mind and better productivity.",
        L"Batch similar tasks together to reduce context switching and improve efficiency.",
        L"Take regular breaks to stretch and hydrate. Your body and mind will thank you.",
        L"Set specific, measurable goals for each work session to track your progress.",
        L"Review your notes at the end of each day. Reflection strengthens understanding.",
        L"Use keyboard shortcuts whenever possible. They save significant time over the long run.",
        L"Prioritize deep work during your peak energy hours, usually in the morning.",
        L"Write meeting action items immediately. Delayed notes lose critical details.",
        L"Limit email checking to 3 times per day to avoid constant interruptions.",
        L"Break large projects into smaller milestones to maintain momentum and motivation.",
    };
    return tips[DayHash() % 12];
}

std::wstring GetDailyQuote() {
    static const wchar_t* quotes[] = {
        L"\"The only way to do great work is to love what you do.\" - Steve Jobs",
        L"\"Innovation distinguishes between a leader and a follower.\" - Steve Jobs",
        L"\"Stay hungry, stay foolish.\" - Steve Jobs",
        L"\"The best time to plant a tree was 20 years ago. The second best time is now.\" - Chinese Proverb",
        L"\"A journey of a thousand miles begins with a single step.\" - Lao Tzu",
        L"\"The secret of getting ahead is getting started.\" - Mark Twain",
        L"\"It does not matter how slowly you go as long as you do not stop.\" - Confucius",
        L"\"Learning without thought is labor lost.\" - Confucius",
        L"\"The man who moves a mountain begins by carrying away small stones.\" - Confucius",
        L"\"Success is not final, failure is not fatal: it is the courage to continue that counts.\" - Churchill",
        L"\"What we know is a drop, what we don't know is an ocean.\" - Isaac Newton",
        L"\"The only impossible journey is the one you never begin.\" - Tony Robbins",
    };
    return quotes[DayHash() % 12];
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Class
// ─────────────────────────────────────────────────────────────────────────────
class App {
public:
    HINSTANCE hInst;
    HWND hMain = nullptr;

    HWND hToolbar   = nullptr;
    HWND hSidebar   = nullptr;
    HWND hTreeView  = nullptr;
    HWND hContainer = nullptr;
    HWND hTitleEdit = nullptr;
    HWND hEditor    = nullptr;
    HWND hStatus    = nullptr;

    HWND hEbFrame   = nullptr;
    HWND hEbText    = nullptr;
    HWND hEbBtnLoad = nullptr;
    HWND hEbBtnPrev = nullptr;
    HWND hEbBtnNext = nullptr;
    HWND hEbPageLbl = nullptr;
    HWND hEbInfoLbl = nullptr;

    HWND hExFrame     = nullptr;
    HWND hExQuestion  = nullptr;
    HWND hExOptA = nullptr, hExOptB = nullptr, hExOptC = nullptr, hExOptD = nullptr;
    HWND hExBtnLoad   = nullptr;
    HWND hExBtnSubmit = nullptr;
    HWND hExBtnReset  = nullptr;
    HWND hExBtnPrev   = nullptr;
    HWND hExBtnNext   = nullptr;
    HWND hExProgress  = nullptr;
    HWND hExResult    = nullptr;

    HWND hDashFrame       = nullptr;
    HWND hDashGreeting    = nullptr;
    HWND hDashDate        = nullptr;
    HWND hDashTime        = nullptr;
    HWND hDashWeatherIcon = nullptr;
    HWND hDashWeatherTemp = nullptr;
    HWND hDashWeatherDesc = nullptr;
    HWND hDashWeatherCity = nullptr;
    HWND hDashNewsTitle   = nullptr;
    HWND hDashNews[6]     = {};
    HWND hDashTipTitle    = nullptr;
    HWND hDashTipText     = nullptr;
    HWND hDashSysTitle    = nullptr;
    HWND hDashSysText     = nullptr;
    HWND hDashQuote       = nullptr;

    HFONT fUI = nullptr, fEditor = nullptr, fTitle = nullptr, fBold = nullptr;
    HFONT fDashGreeting = nullptr, fDashTime = nullptr, fDashDate = nullptr;
    HFONT fDashCardTitle = nullptr, fDashCardText = nullptr, fDashWeatherIcon = nullptr;
    HFONT fDashWeatherTemp = nullptr, fDashNewsItem = nullptr, fDashQuote = nullptr;
    HFONT fSidebarTitle = nullptr, fToolbarBtn = nullptr;

    HBRUSH brSidebar = nullptr, brToolbar = nullptr, brDash = nullptr;
    HBRUSH brCard = nullptr, brStatus = nullptr, brEditor = nullptr;

    Theme theme;

    bool sidebarVisible  = true;
    bool isFullscreen    = false;
    bool panelArmed      = false;
    bool panelVisible    = false;
    PanelType activePanel = PANEL_NONE;
    ViewMode viewMode    = VIEW_DASHBOARD;

    std::wstring bookContent;
    int ebPage = 0;
    int ebPageSize = 2000;

    std::vector<Question> questions;
    int exCurrent = 0;
    std::map<int, wchar_t> exAnswers;

    WeatherInfo weather;
    std::vector<NewsItem> newsItems;
    std::wstring settingsCity = L"Beijing";

    WNDPROC dashOrigProc = nullptr;

    // ─── Init ────────────────────────────────────────────────────────────────
    bool Init(HINSTANCE hInstance, int nCmdShow) {
        hInst = hInstance;

        INITCOMMONCONTROLSEX icex = {sizeof(icex), ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES};
        InitCommonControlsEx(&icex);

        LoadSettings();

        WNDCLASSEXW wc = {};
        wc.cbSize        = sizeof(wc);
        wc.style         = CS_HREDRAW | CS_VREDRAW;
        wc.lpfnWndProc   = StaticWndProc;
        wc.hInstance     = hInstance;
        wc.hCursor       = LoadCursor(nullptr, IDC_ARROW);
        wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
        wc.lpszClassName = CLASS_NAME;
        wc.hIcon         = LoadIcon(nullptr, IDI_APPLICATION);
        wc.hIconSm       = LoadIcon(nullptr, IDI_APPLICATION);
        RegisterClassExW(&wc);

        hMain = CreateWindowExW(0, CLASS_NAME, WINDOW_TITLE,
                                WS_OVERLAPPEDWINDOW,
                                CW_USEDEFAULT, CW_USEDEFAULT, 1280, 860,
                                nullptr, nullptr, hInstance, this);
        if (!hMain) return false;

        CreateFonts();
        CreateBrushes();
        CreateMenu_();
        CreateToolbar_();
        CreateSidebar_();
        CreateEditorContainer_();
        CreateStatusBar_();
        CreateEbookPanel_();
        CreateExamPanel_();
        CreateDashboard_();
        PopulateTreeView_();

        RegisterHotKey(hMain, 1, MOD_CONTROL | MOD_SHIFT, 'E');
        RegisterHotKey(hMain, 2, MOD_CONTROL | MOD_SHIFT, 'Q');
        RegisterHotKey(hMain, 3, MOD_CONTROL | MOD_SHIFT, 'W');

        SetTimer(hMain, CLOCK_TIMER, CLOCK_INTERVAL, nullptr);

        ShowWindow(hMain, nCmdShow);
        UpdateWindow(hMain);

        weather = FetchWeather(settingsCity);
        newsItems = FetchNews();
        UpdateDashboard();

        return true;
    }

    // ─── Settings ────────────────────────────────────────────────────────────
    void LoadSettings() {
        std::wstring dir = GetAppDirectory();
        std::wstring path = dir + L"settings.ini";
        std::wstring content = ReadFileUTF8(path.c_str());
        if (content.empty()) return;
        size_t pos = content.find(L"city=");
        if (pos != std::wstring::npos) {
            size_t start = pos + 5;
            size_t end = content.find(L'\n', start);
            if (end == std::wstring::npos) end = content.size();
            settingsCity = content.substr(start, end - start);
            while (!settingsCity.empty() && (settingsCity.back() == L'\r' || settingsCity.back() == L'\n' || settingsCity.back() == L' '))
                settingsCity.pop_back();
        }
    }

    void SaveSettings() {
        std::wstring dir = GetAppDirectory();
        std::wstring path = dir + L"settings.ini";
        std::wstring content = L"city=" + settingsCity + L"\n";
        WriteFileUTF8(path.c_str(), content);
    }

    // ─── Fonts ───────────────────────────────────────────────────────────────
    void CreateFonts() {
        fUI     = MakeFont(L"Segoe UI", 9, hMain);
        fEditor = MakeFont(L"Consolas", 11, hMain);
        fTitle  = MakeFont(L"Segoe UI Semibold", 14, hMain, true);
        fBold   = MakeFont(L"Segoe UI Semibold", 9, hMain, true);
        fSidebarTitle = MakeFont(L"Segoe UI Semibold", 11, hMain, true);
        fToolbarBtn = MakeFont(L"Segoe UI", 9, hMain);

        fDashGreeting = MakeFont(L"Segoe UI Light", 26, hMain);
        fDashTime = MakeFont(L"Segoe UI Light", 42, hMain);
        fDashDate = MakeFont(L"Segoe UI", 11, hMain);
        fDashCardTitle = MakeFont(L"Segoe UI Semibold", 11, hMain, true);
        fDashCardText = MakeFont(L"Segoe UI", 10, hMain);
        fDashWeatherIcon = MakeFont(L"Segoe UI Emoji", 36, hMain);
        fDashWeatherTemp = MakeFont(L"Segoe UI Light", 32, hMain);
        fDashNewsItem = MakeFont(L"Segoe UI", 10, hMain);
        fDashQuote = MakeFont(L"Segoe UI", 10, hMain, false, true);
    }

    void CreateBrushes() {
        brSidebar = CreateSolidBrush(theme.sidebarBg);
        brToolbar = CreateSolidBrush(theme.toolbarBg);
        brDash    = CreateSolidBrush(theme.dashBg);
        brCard    = CreateSolidBrush(theme.cardBg);
        brStatus  = CreateSolidBrush(theme.statusBg);
        brEditor  = CreateSolidBrush(theme.editorBg);
    }

    // ─── Menu ────────────────────────────────────────────────────────────────
    void CreateMenu_() {
        HMENU bar = CreateMenu();

        HMENU file = CreatePopupMenu();
        AppendMenuW(file, MF_STRING, IDM_FILE_NEW,  L"New Note\tCtrl+N");
        AppendMenuW(file, MF_STRING, IDM_FILE_OPEN, L"Open Note...\tCtrl+O");
        AppendMenuW(file, MF_STRING, IDM_FILE_SAVE, L"Save Note\tCtrl+S");
        AppendMenuW(file, MF_SEPARATOR, 0, nullptr);
        AppendMenuW(file, MF_STRING, IDM_FILE_EXIT, L"Exit\tAlt+F4");

        HMENU edit = CreatePopupMenu();
        AppendMenuW(edit, MF_STRING, IDM_EDIT_UNDO,  L"Undo\tCtrl+Z");
        AppendMenuW(edit, MF_SEPARATOR, 0, nullptr);
        AppendMenuW(edit, MF_STRING, IDM_EDIT_CUT,   L"Cut\tCtrl+X");
        AppendMenuW(edit, MF_STRING, IDM_EDIT_COPY,  L"Copy\tCtrl+C");
        AppendMenuW(edit, MF_STRING, IDM_EDIT_PASTE, L"Paste\tCtrl+V");

        HMENU view = CreatePopupMenu();
        AppendMenuW(view, MF_STRING, IDM_VIEW_DASHBOARD, L"Dashboard\tCtrl+D");
        AppendMenuW(view, MF_SEPARATOR, 0, nullptr);
        AppendMenuW(view, MF_STRING, IDM_VIEW_SIDEBAR,    L"Toggle Sidebar\tCtrl+B");
        AppendMenuW(view, MF_STRING, IDM_VIEW_FULLSCREEN, L"Full Screen\tF11");

        HMENU tools = CreatePopupMenu();
        AppendMenuW(tools, MF_STRING, IDM_TOOLS_WORDCOUNT, L"Word Count");
        AppendMenuW(tools, MF_STRING, IDM_TOOLS_DATETIME,  L"Insert Date/Time");
        AppendMenuW(tools, MF_SEPARATOR, 0, nullptr);
        AppendMenuW(tools, MF_STRING, IDM_TOOLS_SETTINGS,  L"Settings...");

        HMENU help = CreatePopupMenu();
        AppendMenuW(help, MF_STRING, IDM_HELP_WEATHER, L"Refresh Weather");
        AppendMenuW(help, MF_STRING, IDM_HELP_NEWS,    L"Refresh News");
        AppendMenuW(help, MF_SEPARATOR, 0, nullptr);
        AppendMenuW(help, MF_STRING, IDM_HELP_ABOUT,   L"About WorkNotes Pro");

        AppendMenuW(bar, MF_POPUP, (UINT_PTR)file,  L"&File");
        AppendMenuW(bar, MF_POPUP, (UINT_PTR)edit,  L"&Edit");
        AppendMenuW(bar, MF_POPUP, (UINT_PTR)view,  L"&View");
        AppendMenuW(bar, MF_POPUP, (UINT_PTR)tools, L"&Tools");
        AppendMenuW(bar, MF_POPUP, (UINT_PTR)help,  L"&Help");

        SetMenu(hMain, bar);
    }

    // ─── Toolbar ─────────────────────────────────────────────────────────────
    void CreateToolbar_() {
        hToolbar = CreateWindowExW(0, L"STATIC", L"",
                                   WS_CHILD | WS_VISIBLE | SS_OWNERDRAW,
                                   0, 0, 0, TOOLBAR_H, hMain, nullptr, hInst, nullptr);

        auto btn = [&](const wchar_t* text, CtrlID id, int x, int w) {
            HWND h = CreateWindowExW(0, L"BUTTON", text,
                                     WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                     x, 7, w, 28, hToolbar, (HMENU)(LONG_PTR)id, hInst, nullptr);
            SendMessage(h, WM_SETFONT, (WPARAM)fToolbarBtn, TRUE);
        };

        btn(L"  New",    IDC_BTN_NEW,       8,  72);
        btn(L"  Save",   IDC_BTN_SAVE,      86, 72);
        btn(L"  Open",   IDC_BTN_OPEN,      164, 72);
        btn(L"  B",      IDC_BTN_BOLD,      252, 38);
        btn(L"  I",      IDC_BTN_ITALIC,    296, 38);
        btn(L"  U",      IDC_BTN_UNDERLINE, 340, 38);
    }

    // ─── Sidebar ─────────────────────────────────────────────────────────────
    void CreateSidebar_() {
        hSidebar = CreateWindowExW(0, L"STATIC", L"",
                                   WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | SS_OWNERDRAW,
                                   0, 0, SIDEBAR_W, 0, hMain, (HMENU)IDC_SIDEBAR, hInst, nullptr);

        HWND lbl = CreateWindowExW(0, L"STATIC", L"  WORKSPACE",
                                   WS_CHILD | WS_VISIBLE | SS_LEFT,
                                   0, 10, SIDEBAR_W, 28, hSidebar, nullptr, hInst, nullptr);
        SendMessage(lbl, WM_SETFONT, (WPARAM)fSidebarTitle, TRUE);

        HWND search = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"",
                                      WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL,
                                      12, 44, SIDEBAR_W - 24, 28, hSidebar, nullptr, hInst, nullptr);
        SendMessage(search, WM_SETFONT, (WPARAM)fUI, TRUE);
        SendMessageW(search, EM_SETCUEBANNER, 0, (LPARAM)L"Search notes...");

        hTreeView = CreateWindowExW(0, WC_TREEVIEWW, L"",
                                    WS_CHILD | WS_VISIBLE | TVS_HASLINES | TVS_HASBUTTONS |
                                    TVS_LINESATROOT | TVS_SHOWSELALWAYS,
                                    8, 80, SIDEBAR_W - 16, 500, hSidebar, (HMENU)IDC_TREEVIEW, hInst, nullptr);
        SendMessage(hTreeView, WM_SETFONT, (WPARAM)fUI, TRUE);

        TreeView_SetBkColor(hTreeView, theme.sidebarBg);
        TreeView_SetTextColor(hTreeView, theme.sidebarText);
    }

    void PopulateTreeView_() {
        struct FolderDef { const wchar_t* name; const wchar_t* children[5]; int count; };
        static const FolderDef folders[] = {
            {L"Q3 Project Plan", {L"Sprint Backlog", L"Architecture Doc", L"API Design", L"Test Cases", L""}, 4},
            {L"Meeting Notes",   {L"2026-07-28 Standup", L"2026-07-30 Review", L"2026-08-01 Planning", L""}, 3},
            {L"Technical Docs",  {L"System Architecture", L"Database Schema", L"Deployment Guide", L"CI/CD Pipeline", L"Security Audit"}, 5},
            {L"Research",        {L"Market Analysis", L"Competitor Review", L"User Survey Results", L""}, 3},
            {L"Personal",        {L"Learning Plan", L"Book Notes", L"Weekly Review", L""}, 3},
            {L"Archive",         {L"Q2 Report", L"Legacy API Docs", L"Old Meeting Notes", L""}, 3},
        };

        for (int i = 0; i < 6; i++) {
            TVINSERTSTRUCTW ti = {};
            ti.hParent = TVI_ROOT;
            ti.hInsertAfter = TVI_LAST;
            ti.item.mask = TVIF_TEXT;
            ti.item.pszText = (LPWSTR)folders[i].name;
            HTREEITEM hFolder = (HTREEITEM)SendMessageW(hTreeView, TVM_INSERTITEMW, 0, (LPARAM)&ti);
            for (int j = 0; j < folders[i].count; j++) {
                ti.hParent = hFolder;
                ti.item.pszText = (LPWSTR)folders[i].children[j];
                SendMessageW(hTreeView, TVM_INSERTITEMW, 0, (LPARAM)&ti);
            }
            if (i < 3) SendMessageW(hTreeView, TVM_EXPAND, TVE_EXPAND, (LPARAM)hFolder);
        }
    }

    // ─── Editor ──────────────────────────────────────────────────────────────
    void CreateEditorContainer_() {
        hContainer = CreateWindowExW(0, L"STATIC", L"",
                                     WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN,
                                     0, 0, 0, 0, hMain, (HMENU)IDC_EDITOR_CONTAINER, hInst, nullptr);

        hTitleEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"Untitled Note",
                                     WS_CHILD | ES_AUTOHSCROLL,
                                     0, 0, 0, TITLE_H, hContainer, (HMENU)IDC_TITLE_EDIT, hInst, nullptr);
        SendMessage(hTitleEdit, WM_SETFONT, (WPARAM)fTitle, TRUE);

        hEditor = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"",
                                  WS_CHILD | ES_MULTILINE | ES_AUTOVSCROLL |
                                  ES_WANTRETURN | WS_VSCROLL | WS_HSCROLL,
                                  0, 0, 0, 0, hContainer, (HMENU)IDC_NOTE_EDITOR, hInst, nullptr);
        SendMessage(hEditor, WM_SETFONT, (WPARAM)fEditor, TRUE);
        SetWindowTextW(hEditor, L"Welcome to WorkNotes Pro!\r\n\r\nStart typing your notes here...");
    }

    // ─── Status Bar ──────────────────────────────────────────────────────────
    void CreateStatusBar_() {
        hStatus = CreateWindowExW(0, STATUSCLASSNAMEW, L"",
                                  WS_CHILD | WS_VISIBLE | SBARS_SIZEGRIP,
                                  0, 0, 0, 0, hMain, (HMENU)IDC_STATUSBAR, hInst, nullptr);
        SendMessage(hStatus, WM_SETFONT, (WPARAM)fUI, TRUE);
        int parts[] = {260, 500, 700, -1};
        SendMessage(hStatus, SB_SETPARTS, 4, (LPARAM)parts);
        SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Ready");
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Dashboard");
        SendMessageW(hStatus, SB_SETTEXTW, 2, (LPARAM)L"");
        SendMessageW(hStatus, SB_SETTEXTW, 3, (LPARAM)L"");
    }

    void UpdateStatusBarClock() {
        time_t now = time(nullptr);
        tm t; localtime_s(&t, &now);
        wchar_t buf[64];
        wcsftime(buf, 64, L" %Y-%m-%d %H:%M:%S", &t);
        SendMessageW(hStatus, SB_SETTEXTW, 3, (LPARAM)buf);
    }

    // ─── Dashboard ───────────────────────────────────────────────────────────
    void CreateDashboard_() {
        hDashFrame = CreateWindowExW(0, L"STATIC", L"",
                                     WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | SS_OWNERDRAW,
                                     0, 0, 0, 0, hContainer, (HMENU)IDC_DASH_FRAME, hInst, nullptr);

        SetWindowLongPtrW(hDashFrame, GWLP_USERDATA, (LONG_PTR)this);
        dashOrigProc = (WNDPROC)SetWindowLongPtrW(hDashFrame, GWLP_WNDPROC, (LONG_PTR)DashSubProc);

        auto lbl = [&](HWND& h, const wchar_t* text, int x, int y, int w, int ht, HFONT font, DWORD style = SS_LEFT) {
            h = CreateWindowExW(0, L"STATIC", text,
                                WS_CHILD | WS_VISIBLE | style,
                                x, y, w, ht, hDashFrame, nullptr, hInst, nullptr);
            SendMessage(h, WM_SETFONT, (WPARAM)font, TRUE);
        };

        lbl(hDashGreeting, L"Good Morning", 30, 20, 600, 40, fDashGreeting);
        lbl(hDashDate, L"", 30, 65, 400, 22, fDashDate);
        lbl(hDashTime, L"", 30, 90, 300, 55, fDashTime);

        lbl(hDashWeatherIcon, L"\u2600", 30, 170, 70, 60, fDashWeatherIcon);
        lbl(hDashWeatherTemp, L"--\u00B0C", 105, 170, 150, 40, fDashWeatherTemp);
        lbl(hDashWeatherDesc, L"Loading...", 105, 210, 200, 20, fDashCardText);
        lbl(hDashWeatherCity, L"", 105, 232, 200, 18, fDashCardText);

        lbl(hDashNewsTitle, L"Today's Headlines", 380, 170, 300, 22, fDashCardTitle);

        for (int i = 0; i < 6; i++) {
            lbl(hDashNews[i], L"", 380, 198 + i * 24, 500, 22, fDashNewsItem);
        }

        lbl(hDashTipTitle, L"Productivity Tip", 30, 280, 300, 22, fDashCardTitle);
        lbl(hDashTipText, L"", 30, 308, 320, 60, fDashCardText);

        lbl(hDashSysTitle, L"System Info", 380, 360, 300, 22, fDashCardTitle);
        lbl(hDashSysText, L"", 380, 388, 400, 80, fDashCardText);

        lbl(hDashQuote, L"", 30, 400, 320, 60, fDashQuote);
    }

    static LRESULT CALLBACK DashSubProc(HWND h, UINT msg, WPARAM wp, LPARAM lp) {
        App* self = (App*)GetWindowLongPtrW(h, GWLP_USERDATA);
        WNDPROC orig = self ? self->dashOrigProc : nullptr;

        if (!self || !orig) return DefWindowProcW(h, msg, wp, lp);

        switch (msg) {
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(h, &ps);
            RECT rc; GetClientRect(h, &rc);

            HBRUSH bg = CreateSolidBrush(self->theme.dashBg);
            FillRect(hdc, &rc, bg);
            DeleteObject(bg);

            HPEN cardPen = CreatePen(PS_SOLID, 1, self->theme.cardBorder);
            HBRUSH cardBr = CreateSolidBrush(self->theme.cardBg);
            HGDIOBJ oldPen = SelectObject(hdc, cardPen);
            HGDIOBJ oldBr = SelectObject(hdc, cardBr);

            RoundRect(hdc, 20, 155, 350, 260, 8, 8);
            RoundRect(hdc, 370, 155, 880, 350, 8, 8);
            RoundRect(hdc, 20, 270, 350, 390, 8, 8);
            RoundRect(hdc, 370, 355, 880, 475, 8, 8);

            HBRUSH weatherBr = CreateSolidBrush(self->theme.weatherBg);
            HGDIOBJ oldBr2 = SelectObject(hdc, weatherBr);
            HPEN weatherPen = CreatePen(PS_SOLID, 1, self->theme.weatherBg);
            HGDIOBJ oldPen2 = SelectObject(hdc, weatherPen);
            RoundRect(hdc, 20, 155, 350, 260, 8, 8);

            SelectObject(hdc, oldPen2);
            DeleteObject(weatherPen);
            SelectObject(hdc, oldBr2);
            DeleteObject(weatherBr);

            HBRUSH tipBr = CreateSolidBrush(self->theme.tipBg);
            HPEN tipPen = CreatePen(PS_SOLID, 1, self->theme.tipBorder);
            oldBr2 = SelectObject(hdc, tipBr);
            oldPen2 = SelectObject(hdc, tipPen);
            RoundRect(hdc, 20, 270, 350, 390, 8, 8);
            SelectObject(hdc, oldPen2); DeleteObject(tipPen);
            SelectObject(hdc, oldBr2); DeleteObject(tipBr);

            HBRUSH sysBr = CreateSolidBrush(self->theme.sysBg);
            HPEN sysPen = CreatePen(PS_SOLID, 1, self->theme.sysBorder);
            oldBr2 = SelectObject(hdc, sysBr);
            oldPen2 = SelectObject(hdc, sysPen);
            RoundRect(hdc, 370, 355, 880, 475, 8, 8);
            SelectObject(hdc, oldPen2); DeleteObject(sysPen);
            SelectObject(hdc, oldBr2); DeleteObject(sysBr);

            SelectObject(hdc, oldPen);
            DeleteObject(cardPen);
            SelectObject(hdc, oldBr);
            DeleteObject(cardBr);

            EndPaint(h, &ps);
            return 0;
        }
        case WM_ERASEBKGND:
            return 1;
        }
        if (orig) return CallWindowProcW(orig, h, msg, wp, lp);
        return DefWindowProcW(h, msg, wp, lp);
    }

    void UpdateDashboard() {
        time_t now = time(nullptr);
        tm t; localtime_s(&t, &now);

        const wchar_t* greet;
        if (t.tm_hour < 6) greet = L"Good Night";
        else if (t.tm_hour < 12) greet = L"Good Morning";
        else if (t.tm_hour < 14) greet = L"Good Afternoon";
        else if (t.tm_hour < 18) greet = L"Good Afternoon";
        else greet = L"Good Evening";
        SetWindowTextW(hDashGreeting, greet);

        const wchar_t* weekdays[] = {L"Sunday", L"Monday", L"Tuesday", L"Wednesday",
                                      L"Thursday", L"Friday", L"Saturday"};
        static const wchar_t* months[] = {L"January", L"February", L"March", L"April",
                                           L"May", L"June", L"July", L"August",
                                           L"September", L"October", L"November", L"December"};
        wchar_t dateBuf[128];
        wsprintfW(dateBuf, L"%s, %s %d, %d", weekdays[t.tm_wday], months[t.tm_mon], t.tm_mday, t.tm_year + 1900);
        SetWindowTextW(hDashDate, dateBuf);

        wchar_t timeBuf[32];
        wsprintfW(timeBuf, L"%02d:%02d", t.tm_hour, t.tm_min);
        SetWindowTextW(hDashTime, timeBuf);

        std::wstring iconStr = weather.icon.empty() ? L"\u2600" : weather.icon;
        SetWindowTextW(hDashWeatherIcon, iconStr.c_str());

        wchar_t tempBuf[32];
        wsprintfW(tempBuf, L"%d\u00B0C", weather.tempC);
        SetWindowTextW(hDashWeatherTemp, tempBuf);

        std::wstring descStr = weather.desc;
        if (weather.isMock) descStr += L" (estimated)";
        descStr += L"  |  Humidity: " + std::to_wstring(weather.humidity) + L"%  |  Wind: " + std::to_wstring(weather.windKph) + L" km/h";
        SetWindowTextW(hDashWeatherDesc, descStr.c_str());
        SetWindowTextW(hDashWeatherCity, (L"  " + weather.city).c_str());

        for (int i = 0; i < 6; i++) {
            if (i < (int)newsItems.size()) {
                std::wstring txt = std::to_wstring(i + 1) + L".  " + newsItems[i].title;
                SetWindowTextW(hDashNews[i], txt.c_str());
            } else {
                SetWindowTextW(hDashNews[i], L"");
            }
        }

        SetWindowTextW(hDashTipText, GetProductivityTip().c_str());
        SetWindowTextW(hDashQuote, GetDailyQuote().c_str());

        MEMORYSTATUSEX memInfo = {sizeof(memInfo)};
        GlobalMemoryStatusEx(&memInfo);
        DWORD totalMB = (DWORD)(memInfo.ullTotalPhys / (1024 * 1024));
        DWORD usedMB = totalMB - (DWORD)(memInfo.ullAvailPhys / (1024 * 1024));
        DWORD usagePct = (DWORD)((usedMB * 100) / totalMB);

        SYSTEM_INFO sysInfo;
        GetSystemInfo(&sysInfo);

        wchar_t sysBuf[512];
        wsprintfW(sysBuf,
                  L"CPU Cores: %d  |  Architecture: %s\n"
                  L"Memory: %d MB / %d MB (%d%% used)\n"
                  L"Computer: %s",
                  sysInfo.dwNumberOfProcessors,
                  sysInfo.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64 ? L"x64" :
                  sysInfo.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_ARM64 ? L"ARM64" : L"x86",
                  usedMB, totalMB, usagePct,
                  L"WorkStation");

        wchar_t compName[MAX_COMPUTERNAME_LENGTH + 1] = {};
        DWORD compLen = MAX_COMPUTERNAME_LENGTH + 1;
        GetComputerNameW(compName, &compLen);

        std::wstring sysStr = sysBuf;
        size_t pos = sysStr.find(L"WorkStation");
        if (pos != std::wstring::npos) sysStr.replace(pos, 11, compName);
        SetWindowTextW(hDashSysText, sysStr.c_str());

        UpdateStatusBarClock();
        InvalidateRect(hDashFrame, nullptr, TRUE);
    }

    void RefreshWeather() {
        weather = FetchWeather(settingsCity);
        if (hDashFrame) UpdateDashboard();
    }

    void RefreshNews() {
        newsItems = FetchNews();
        if (hDashFrame) UpdateDashboard();
    }

    // ─── Ebook Panel ─────────────────────────────────────────────────────────
    void CreateEbookPanel_() {
        hEbFrame = CreateWindowExW(0, L"STATIC", L"",
                                   WS_CHILD | WS_CLIPCHILDREN,
                                   0, 0, 0, 0, hContainer, (HMENU)IDC_EBOOK_FRAME, hInst, nullptr);

        hEbBtnLoad = CreateWindowExW(0, L"BUTTON", L"Load Document",
                                     WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                     5, 5, 120, 30, hEbFrame, (HMENU)IDC_BTN_EB_LOAD, hInst, nullptr);
        hEbBtnPrev = CreateWindowExW(0, L"BUTTON", L"< Previous",
                                     WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                     130, 5, 85, 30, hEbFrame, (HMENU)IDC_BTN_EB_PREV, hInst, nullptr);
        hEbBtnNext = CreateWindowExW(0, L"BUTTON", L"Next >",
                                     WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                     220, 5, 85, 30, hEbFrame, (HMENU)IDC_BTN_EB_NEXT, hInst, nullptr);

        hEbPageLbl = CreateWindowExW(0, L"STATIC", L"Page: 0/0",
                                     WS_CHILD | WS_VISIBLE | SS_RIGHT,
                                     310, 10, 140, 20, hEbFrame, nullptr, hInst, nullptr);

        hEbInfoLbl = CreateWindowExW(0, L"STATIC", L"No document loaded. Click 'Load Document' to open.",
                                     WS_CHILD | WS_VISIBLE | SS_LEFT,
                                     5, 40, 500, 18, hEbFrame, nullptr, hInst, nullptr);

        hEbText = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"",
                                  WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_READONLY |
                                  WS_VSCROLL | WS_HSCROLL,
                                  5, 62, 800, 500, hEbFrame, (HMENU)IDC_EBOOK_TEXT, hInst, nullptr);

        HWND ctrls[] = {hEbBtnLoad, hEbBtnPrev, hEbBtnNext, hEbPageLbl, hEbInfoLbl, hEbText};
        for (HWND h : ctrls) SendMessage(h, WM_SETFONT, (WPARAM)fUI, TRUE);
        SendMessage(hEbText, WM_SETFONT, (WPARAM)fEditor, TRUE);
    }

    // ─── Exam Panel ──────────────────────────────────────────────────────────
    void CreateExamPanel_() {
        hExFrame = CreateWindowExW(0, L"STATIC", L"",
                                   WS_CHILD | WS_CLIPCHILDREN,
                                   0, 0, 0, 0, hContainer, (HMENU)IDC_EXAM_FRAME, hInst, nullptr);

        hExBtnLoad   = CreateWindowExW(0, L"BUTTON", L"Load Task List",
                                       WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                       5, 5, 120, 30, hExFrame, (HMENU)IDC_BTN_EX_LOAD, hInst, nullptr);
        hExBtnSubmit = CreateWindowExW(0, L"BUTTON", L"Submit All",
                                       WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                       130, 5, 95, 30, hExFrame, (HMENU)IDC_BTN_EX_SUBMIT, hInst, nullptr);
        hExBtnReset  = CreateWindowExW(0, L"BUTTON", L"Reset",
                                       WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                       230, 5, 70, 30, hExFrame, (HMENU)IDC_BTN_EX_RESET, hInst, nullptr);

        hExProgress = CreateWindowExW(0, L"STATIC", L"Progress: 0/0",
                                      WS_CHILD | WS_VISIBLE | SS_RIGHT,
                                      320, 10, 140, 20, hExFrame, nullptr, hInst, nullptr);

        hExQuestion = CreateWindowExW(0, L"STATIC", L"No task list loaded. Click 'Load Task List' to import.",
                                      WS_CHILD | WS_VISIBLE | SS_LEFT,
                                      15, 48, 750, 50, hExFrame, (HMENU)IDC_EXAM_QUESTION, hInst, nullptr);
        SendMessage(hExQuestion, WM_SETFONT, (WPARAM)fBold, TRUE);

        DWORD rbs = WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON;
        hExOptA = CreateWindowExW(0, L"BUTTON", L"A. ", rbs | WS_GROUP | WS_TABSTOP,
                                  25, 115, 700, 26, hExFrame, (HMENU)IDC_EXAM_OPT_A, hInst, nullptr);
        hExOptB = CreateWindowExW(0, L"BUTTON", L"B. ", rbs,
                                  25, 147, 700, 26, hExFrame, (HMENU)IDC_EXAM_OPT_B, hInst, nullptr);
        hExOptC = CreateWindowExW(0, L"BUTTON", L"C. ", rbs,
                                  25, 179, 700, 26, hExFrame, (HMENU)IDC_EXAM_OPT_C, hInst, nullptr);
        hExOptD = CreateWindowExW(0, L"BUTTON", L"D. ", rbs,
                                  25, 211, 700, 26, hExFrame, (HMENU)IDC_EXAM_OPT_D, hInst, nullptr);

        hExBtnPrev = CreateWindowExW(0, L"BUTTON", L"< Previous",
                                     WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                     5, 260, 95, 30, hExFrame, (HMENU)IDC_BTN_EX_PREV, hInst, nullptr);
        hExBtnNext = CreateWindowExW(0, L"BUTTON", L"Next >",
                                     WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                     105, 260, 95, 30, hExFrame, (HMENU)IDC_BTN_EX_NEXT, hInst, nullptr);

        hExResult = CreateWindowExW(0, L"STATIC", L"",
                                    WS_CHILD | WS_VISIBLE | SS_RIGHT,
                                    210, 265, 250, 22, hExFrame, nullptr, hInst, nullptr);
        SendMessage(hExResult, WM_SETFONT, (WPARAM)fBold, TRUE);

        HWND ctrls[] = {hExBtnLoad, hExBtnSubmit, hExBtnReset, hExProgress,
                        hExQuestion, hExOptA, hExOptB, hExOptC, hExOptD,
                        hExBtnPrev, hExBtnNext};
        for (HWND h : ctrls) SendMessage(h, WM_SETFONT, (WPARAM)fUI, TRUE);
    }

    // ─── Layout ──────────────────────────────────────────────────────────────
    void Resize(int cx, int cy) {
        int y = 0;

        MoveWindow(hToolbar, 0, y, cx, TOOLBAR_H, TRUE);
        y += TOOLBAR_H;

        SendMessage(hStatus, WM_SIZE, 0, 0);

        int statusH = STATUSBAR_H;
        int contentH = cy - y - statusH;
        if (contentH < 0) contentH = 0;

        int sideW = sidebarVisible ? SIDEBAR_W : 0;
        MoveWindow(hSidebar, 0, y, sideW, contentH, TRUE);

        if (sidebarVisible) {
            MoveWindow(hTreeView, 8, 80, sideW - 16, contentH - 90, TRUE);
        }

        int edX = sideW;
        int edW = cx - sideW;
        MoveWindow(hContainer, edX, y, edW, contentH, TRUE);

        int pad = 10;
        int innerW = edW - 2 * pad;
        if (innerW < 0) innerW = 0;
        MoveWindow(hTitleEdit, pad, 5, innerW, TITLE_H, TRUE);

        int areaY = 5 + TITLE_H + 5;
        int areaH = contentH - areaY - 5;
        if (areaH < 0) areaH = 0;

        MoveWindow(hEditor,    pad, areaY, innerW, areaH, TRUE);
        MoveWindow(hEbFrame,   pad, areaY, innerW, areaH, TRUE);
        MoveWindow(hExFrame,   pad, areaY, innerW, areaH, TRUE);
        MoveWindow(hDashFrame, 0, 0, innerW + 2 * pad, contentH, TRUE);

        ResizeEbook(innerW, areaH);
        ResizeExam(innerW, areaH);
    }

    void ResizeEbook(int w, int h) {
        MoveWindow(hEbBtnLoad, 5, 5, 120, 30, TRUE);
        MoveWindow(hEbBtnPrev, 130, 5, 85, 30, TRUE);
        MoveWindow(hEbBtnNext, 220, 5, 85, 30, TRUE);
        MoveWindow(hEbPageLbl, w - 160, 10, 150, 20, TRUE);
        MoveWindow(hEbInfoLbl, 5, 40, w - 10, 18, TRUE);
        MoveWindow(hEbText, 5, 62, w - 10, h - 67, TRUE);
    }

    void ResizeExam(int w, int h) {
        MoveWindow(hExBtnLoad,   5,   5, 120, 30, TRUE);
        MoveWindow(hExBtnSubmit, 130, 5, 95,  30, TRUE);
        MoveWindow(hExBtnReset,  230, 5, 70,  30, TRUE);
        MoveWindow(hExProgress,  w - 160, 10, 150, 20, TRUE);
        MoveWindow(hExQuestion,  15, 48, w - 30, 50, TRUE);
        int optW = w - 50;
        MoveWindow(hExOptA, 25, 115, optW, 26, TRUE);
        MoveWindow(hExOptB, 25, 147, optW, 26, TRUE);
        MoveWindow(hExOptC, 25, 179, optW, 26, TRUE);
        MoveWindow(hExOptD, 25, 211, optW, 26, TRUE);
        MoveWindow(hExBtnPrev,  5,   h - 45, 95, 30, TRUE);
        MoveWindow(hExBtnNext,  105, h - 45, 95, 30, TRUE);
        MoveWindow(hExResult,   210, h - 40, w - 220, 22, TRUE);
    }

    // ─── View Switching ──────────────────────────────────────────────────────
    void ShowDashboard() {
        viewMode = VIEW_DASHBOARD;
        ShowWindow(hEditor, SW_HIDE);
        ShowWindow(hTitleEdit, SW_HIDE);
        ShowWindow(hEbFrame, SW_HIDE);
        ShowWindow(hExFrame, SW_HIDE);
        ShowWindow(hDashFrame, SW_SHOW);
        UpdateDashboard();
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Dashboard");
        InvalidateRect(hContainer, nullptr, TRUE);
    }

    void ShowEditor() {
        viewMode = VIEW_EDITOR;
        ShowWindow(hDashFrame, SW_HIDE);
        ShowWindow(hEbFrame, SW_HIDE);
        ShowWindow(hExFrame, SW_HIDE);
        ShowWindow(hTitleEdit, SW_SHOW);
        ShowWindow(hEditor, SW_SHOW);
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Normal");
        InvalidateRect(hContainer, nullptr, TRUE);
    }

    // ─── Panel Show / Hide ───────────────────────────────────────────────────
    void ShowPanel() {
        if (!panelArmed || activePanel == PANEL_NONE) return;
        ShowWindow(hEditor, SW_HIDE);
        ShowWindow(hTitleEdit, SW_HIDE);
        ShowWindow(hDashFrame, SW_HIDE);
        if (activePanel == PANEL_EBOOK)
            ShowWindow(hEbFrame, SW_SHOW);
        else
            ShowWindow(hExFrame, SW_SHOW);
        panelVisible = true;
        viewMode = VIEW_PANEL;
        const wchar_t* mode = (activePanel == PANEL_EBOOK) ? L"Mode: Reference" : L"Mode: Checklist";
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)mode);
        SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Panel active");
        InvalidateRect(hContainer, nullptr, TRUE);
    }

    void HidePanel() {
        if (!panelVisible) return;
        ShowWindow(hEbFrame, SW_HIDE);
        ShowWindow(hExFrame, SW_HIDE);
        if (viewMode == VIEW_PANEL) {
            ShowWindow(hDashFrame, SW_SHOW);
            viewMode = VIEW_DASHBOARD;
        } else {
            ShowWindow(hTitleEdit, SW_SHOW);
            ShowWindow(hEditor, SW_SHOW);
        }
        panelVisible = false;
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Armed");
        SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Ready");
        InvalidateRect(hContainer, nullptr, TRUE);
    }

    void ToggleEbook() {
        if (panelArmed && activePanel == PANEL_EBOOK) { DisarmAll(); return; }
        DisarmAll(true);
        activePanel = PANEL_EBOOK;
        panelArmed = true;
        SetTimer(hMain, HOVER_TIMER, HOVER_INTERVAL, nullptr);
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Armed [E-Reader]");
        SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" E-Reader armed - hover editor to view");
    }

    void ToggleExam() {
        if (panelArmed && activePanel == PANEL_EXAM) { DisarmAll(); return; }
        DisarmAll(true);
        activePanel = PANEL_EXAM;
        panelArmed = true;
        SetTimer(hMain, HOVER_TIMER, HOVER_INTERVAL, nullptr);
        SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Armed [Checklist]");
        SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Checklist armed - hover editor to view");
    }

    void DisarmAll(bool silent = false) {
        KillTimer(hMain, HOVER_TIMER);
        if (panelVisible) HidePanel();
        panelArmed = false;
        panelVisible = false;
        activePanel = PANEL_NONE;
        if (!silent) {
            SendMessageW(hStatus, SB_SETTEXTW, 1, (LPARAM)L"Mode: Dashboard");
            SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Ready");
        }
    }

    void CheckHover() {
        if (!panelArmed) return;
        POINT pt;
        GetCursorPos(&pt);
        RECT rc;
        GetWindowRect(hContainer, &rc);
        bool inside = PtInRect(&rc, pt);
        if (inside && !panelVisible) ShowPanel();
        else if (!inside && panelVisible) HidePanel();
    }

    // ─── Ebook Logic ─────────────────────────────────────────────────────────
    void EbLoad() {
        std::wstring path = OpenFileDialog(hMain,
            L"Text Files (*.txt)\0*.txt\0All Files (*.*)\0*.*\0");
        if (path.empty()) return;
        bookContent = ReadFileUTF8(path.c_str());
        ebPage = 0;
        EbDisplayPage();
        size_t slash = path.find_last_of(L"\\/");
        std::wstring name = (slash != std::wstring::npos) ? path.substr(slash + 1) : path;
        std::wstring info = L"Loaded: " + name;
        SetWindowTextW(hEbInfoLbl, info.c_str());
    }

    void EbDisplayPage() {
        int total = std::max(1, (int)((bookContent.size() + ebPageSize - 1) / ebPageSize));
        if (ebPage < 0) ebPage = 0;
        if (ebPage >= total) ebPage = total - 1;
        size_t start = (size_t)ebPage * ebPageSize;
        size_t end = std::min(start + ebPageSize, bookContent.size());
        std::wstring page = bookContent.substr(start, end - start);
        SetWindowTextW(hEbText, page.c_str());
        wchar_t buf[64];
        wsprintfW(buf, L"Page: %d/%d", ebPage + 1, total);
        SetWindowTextW(hEbPageLbl, buf);
    }

    void EbPrev() { if (ebPage > 0) { ebPage--; EbDisplayPage(); } }
    void EbNext() { ebPage++; EbDisplayPage(); }

    // ─── Exam Logic ──────────────────────────────────────────────────────────
    void ExLoad() {
        std::wstring path = OpenFileDialog(hMain,
            L"JSON Files (*.json)\0*.json\0All Files (*.*)\0*.*\0");
        if (path.empty()) return;
        std::wstring raw = ReadFileUTF8(path.c_str());
        if (raw.empty()) {
            MessageBoxW(hMain, L"Failed to read file.", L"Error", MB_ICONERROR);
            return;
        }
        JsonParser parser;
        JsonValue root = parser.parse(raw);
        questions.clear();
        const JsonValue& qarr = root[L"questions"];
        for (size_t i = 0; i < qarr.size(); i++) {
            const JsonValue& qo = qarr[i];
            Question q;
            q.text = qo[L"question"].str;
            const JsonValue& opts = qo[L"options"];
            for (size_t j = 0; j < opts.size(); j++)
                q.options.push_back(opts[j].str);
            q.answer = qo[L"answer"].str.empty() ? L'A' : qo[L"answer"].str[0];
            questions.push_back(q);
        }
        exCurrent = 0;
        exAnswers.clear();
        ExDisplay();
    }

    void ExDisplay() {
        if (questions.empty()) return;
        const Question& q = questions[exCurrent];
        std::wstring qtxt = L"Task " + std::to_wstring(exCurrent + 1) + L": " + q.text;
        SetWindowTextW(hExQuestion, qtxt.c_str());

        wchar_t labels[] = {L'A', L'B', L'C', L'D'};
        HWND opts[] = {hExOptA, hExOptB, hExOptC, hExOptD};
        for (int i = 0; i < 4; i++) {
            if (i < (int)q.options.size()) {
                std::wstring txt = std::wstring(1, labels[i]) + L".  " + q.options[i];
                SetWindowTextW(opts[i], txt.c_str());
                ShowWindow(opts[i], SW_SHOW);
            } else {
                ShowWindow(opts[i], SW_HIDE);
            }
            SendMessage(opts[i], BM_SETCHECK, BST_UNCHECKED, 0);
        }

        auto it = exAnswers.find(exCurrent);
        if (it != exAnswers.end()) {
            int idx = it->second - L'A';
            if (idx >= 0 && idx < 4)
                SendMessage(opts[idx], BM_SETCHECK, BST_CHECKED, 0);
        }

        wchar_t buf[64];
        wsprintfW(buf, L"Progress: %d/%d", exCurrent + 1, (int)questions.size());
        SetWindowTextW(hExProgress, buf);
    }

    void ExSaveAnswer() {
        HWND opts[] = {hExOptA, hExOptB, hExOptC, hExOptD};
        wchar_t labels[] = {L'A', L'B', L'C', L'D'};
        for (int i = 0; i < 4; i++) {
            if (SendMessage(opts[i], BM_GETCHECK, 0, 0) == BST_CHECKED) {
                exAnswers[exCurrent] = labels[i];
                return;
            }
        }
    }

    void ExPrev() { if (exCurrent > 0) { ExSaveAnswer(); exCurrent--; ExDisplay(); } }
    void ExNext() { if (exCurrent < (int)questions.size() - 1) { ExSaveAnswer(); exCurrent++; ExDisplay(); } }

    void ExSubmit() {
        if (questions.empty()) {
            MessageBoxW(hMain, L"No task list loaded!", L"Warning", MB_ICONWARNING);
            return;
        }
        ExSaveAnswer();
        int score = 0;
        for (int i = 0; i < (int)questions.size(); i++) {
            auto it = exAnswers.find(i);
            if (it != exAnswers.end() && it->second == questions[i].answer) score++;
        }
        double pct = (double)score / questions.size() * 100.0;
        wchar_t buf[128];
        wsprintfW(buf, L"Score: %d/%d (%.1f%%)", score, (int)questions.size(), pct);
        SetWindowTextW(hExResult, buf);
        std::wstring msg = L"Task Completion: " + std::to_wstring(score) + L"/" +
                           std::to_wstring(questions.size()) + L"\nAccuracy: " +
                           std::to_wstring((int)pct) + L"%";
        MessageBoxW(hMain, msg.c_str(), L"Results", MB_ICONINFORMATION);
    }

    void ExReset() {
        exCurrent = 0;
        exAnswers.clear();
        SetWindowTextW(hExResult, L"");
        if (!questions.empty()) ExDisplay();
    }

    // ─── Note Commands ───────────────────────────────────────────────────────
    void NewNote() {
        ShowEditor();
        SetWindowTextW(hTitleEdit, L"Untitled Note");
        SetWindowTextW(hEditor, L"");
        SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" New note created");
    }

    void SaveNote() {
        std::wstring path = SaveFileDialog(hMain,
            L"Text Files (*.txt)\0*.txt\0All Files (*.*)\0*.*\0");
        if (path.empty()) return;
        int len = GetWindowTextLengthW(hEditor);
        std::wstring text(len + 1, 0);
        GetWindowTextW(hEditor, &text[0], len + 1);
        text.resize(len);
        if (WriteFileUTF8(path.c_str(), text)) {
            SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Note saved successfully");
        }
    }

    void OpenNote() {
        std::wstring path = OpenFileDialog(hMain,
            L"Text Files (*.txt)\0*.txt\0All Files (*.*)\0*.*\0");
        if (path.empty()) return;
        ShowEditor();
        std::wstring content = ReadFileUTF8(path.c_str());
        SetWindowTextW(hEditor, content.c_str());
        size_t slash = path.find_last_of(L"\\/");
        std::wstring name = (slash != std::wstring::npos) ? path.substr(slash + 1) : path;
        SetWindowTextW(hTitleEdit, name.c_str());
    }

    void WordCount() {
        int len = GetWindowTextLengthW(hEditor);
        std::wstring text(len + 1, 0);
        GetWindowTextW(hEditor, &text[0], len + 1);
        text.resize(len);
        int words = 0;
        bool inWord = false;
        for (wchar_t c : text) {
            if (std::iswspace(c)) { inWord = false; }
            else if (!inWord) { words++; inWord = true; }
        }
        wchar_t buf[128];
        wsprintfW(buf, L"Words: %d\nCharacters: %d", words, len);
        MessageBoxW(hMain, buf, L"Word Count", MB_ICONINFORMATION);
        wchar_t sb[64];
        wsprintfW(sb, L" Words: %d", words);
        SendMessageW(hStatus, SB_SETTEXTW, 2, (LPARAM)sb);
    }

    void InsertDateTime() {
        if (viewMode != VIEW_EDITOR) ShowEditor();
        time_t now = time(nullptr);
        tm t;
        localtime_s(&t, &now);
        wchar_t buf[64];
        wcsftime(buf, 64, L"%Y-%m-%d %H:%M:%S", &t);
        DWORD start, end;
        SendMessage(hEditor, EM_GETSEL, (WPARAM)&start, (LPARAM)&end);
        SendMessageW(hEditor, EM_REPLACESEL, TRUE, (LPARAM)buf);
    }

    void ToggleSidebar() {
        sidebarVisible = !sidebarVisible;
        ShowWindow(hSidebar, sidebarVisible ? SW_SHOW : SW_HIDE);
        RECT rc;
        GetClientRect(hMain, &rc);
        Resize(rc.right, rc.bottom);
    }

    void ToggleFullscreen() {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
            SetMenu(hMain, nullptr);
            ShowWindow(hToolbar, SW_HIDE);
            ShowWindow(hStatus, SW_HIDE);
            SetWindowLongW(hMain, GWL_STYLE, WS_POPUP | WS_VISIBLE);
            ShowWindow(hMain, SW_MAXIMIZE);
        } else {
            CreateMenu_();
            ShowWindow(hToolbar, SW_SHOW);
            ShowWindow(hStatus, SW_SHOW);
            SetWindowLongW(hMain, GWL_STYLE, WS_OVERLAPPEDWINDOW);
            ShowWindow(hMain, SW_RESTORE);
        }
        RECT rc;
        GetClientRect(hMain, &rc);
        Resize(rc.right, rc.bottom);
    }

    void ShowSettings() {
        wchar_t buf[256];
        wcsncpy_s(buf, settingsCity.c_str(), 255);
        buf[255] = 0;

        if (MessageBoxW(hMain,
                L"Enter city name for weather (e.g., Beijing, Shanghai, Tokyo):\n\n"
                L"Click OK to open input, Cancel to keep current setting.",
                L"Settings", MB_OKCANCEL | MB_ICONQUESTION) == IDOK) {
            std::wstring input = InputBox(hMain, L"Weather City", buf);
            if (!input.empty()) {
                settingsCity = input;
                SaveSettings();
                RefreshWeather();
                SendMessageW(hStatus, SB_SETTEXTW, 0, (LPARAM)L" Settings saved - weather refreshed");
            }
        }
    }

    static WNDPROC inputOrigProc;
    static bool inputDone;
    static bool inputOk;

    static LRESULT CALLBACK InputSubProc(HWND h, UINT msg, WPARAM wp, LPARAM lp) {
        if (msg == WM_COMMAND) {
            if (LOWORD(wp) == IDOK) { inputOk = true; inputDone = true; return 0; }
            if (LOWORD(wp) == IDCANCEL) { inputOk = false; inputDone = true; return 0; }
        }
        if (msg == WM_CLOSE) { inputOk = false; inputDone = true; return 0; }
        return CallWindowProcW(inputOrigProc, h, msg, wp, lp);
    }

    std::wstring InputBox(HWND owner, const wchar_t* title, const wchar_t* defaultVal) {
        static wchar_t inputBuf[512];
        wcsncpy_s(inputBuf, defaultVal, 511);

        HWND hPrompt = CreateWindowExW(WS_EX_DLGMODALFRAME | WS_EX_TOPMOST,
                                        L"#32770", title,
                                        WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_VISIBLE,
                                        CW_USEDEFAULT, CW_USEDEFAULT, 400, 170,
                                        owner, nullptr, hInst, nullptr);
        if (!hPrompt) return defaultVal;

        inputOrigProc = (WNDPROC)SetWindowLongPtrW(hPrompt, GWLP_WNDPROC, (LONG_PTR)InputSubProc);

        HWND hLabel = CreateWindowExW(0, L"STATIC", L"City name:",
                                       WS_CHILD | WS_VISIBLE,
                                       15, 15, 360, 20, hPrompt, nullptr, hInst, nullptr);
        SendMessage(hLabel, WM_SETFONT, (WPARAM)fUI, TRUE);

        HWND hInput = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", inputBuf,
                                       WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL | WS_TABSTOP,
                                       15, 42, 360, 28, hPrompt, (HMENU)1001, hInst, nullptr);
        SendMessage(hInput, WM_SETFONT, (WPARAM)fUI, TRUE);

        HWND hOk = CreateWindowExW(0, L"BUTTON", L"OK",
                                    WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON | WS_TABSTOP,
                                    200, 85, 85, 30, hPrompt, (HMENU)IDOK, hInst, nullptr);
        SendMessage(hOk, WM_SETFONT, (WPARAM)fUI, TRUE);

        HWND hCancel = CreateWindowExW(0, L"BUTTON", L"Cancel",
                                        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
                                        290, 85, 85, 30, hPrompt, (HMENU)IDCANCEL, hInst, nullptr);
        SendMessage(hCancel, WM_SETFONT, (WPARAM)fUI, TRUE);

        EnableWindow(owner, FALSE);
        SetFocus(hInput);

        inputDone = false;
        inputOk = false;

        MSG msg;
        while (GetMessageW(&msg, nullptr, 0, 0)) {
            if (IsDialogMessage(hPrompt, &msg)) {
                if (inputDone) break;
                continue;
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
            if (inputDone) break;
        }

        std::wstring retVal = defaultVal;
        if (inputOk) {
            GetWindowTextW(hInput, inputBuf, 512);
            retVal = inputBuf;
        }

        EnableWindow(owner, TRUE);
        DestroyWindow(hPrompt);
        return retVal;
    }

    void ShowAbout() {
        MessageBoxW(hMain,
                    L"WorkNotes Pro v3.0.0\n\n"
                    L"Professional Note Management Solution\n\n"
                    L"Features:\n"
                    L"  - Dashboard with weather & news\n"
                    L"  - E-Reader & Checklist panels\n"
                    L"  - Modern UI design\n\n"
                    L"2026 WorkNotes Inc.",
                    L"About WorkNotes Pro", MB_ICONINFORMATION);
    }

    // ─── WndProc ─────────────────────────────────────────────────────────────
    static LRESULT CALLBACK StaticWndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
        App* self = nullptr;
        if (m == WM_NCCREATE) {
            auto cs = reinterpret_cast<CREATESTRUCTW*>(l);
            self = static_cast<App*>(cs->lpCreateParams);
            SetWindowLongPtrW(h, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
            self->hMain = h;
        } else {
            self = reinterpret_cast<App*>(GetWindowLongPtrW(h, GWLP_USERDATA));
        }
        if (self) return self->WndProc(h, m, w, l);
        return DefWindowProcW(h, m, w, l);
    }

    LRESULT WndProc(HWND h, UINT msg, WPARAM wp, LPARAM lp) {
        switch (msg) {
        case WM_SIZE:
            Resize(LOWORD(lp), HIWORD(lp));
            return 0;

        case WM_TIMER:
            if (wp == HOVER_TIMER) CheckHover();
            if (wp == CLOCK_TIMER) {
                UpdateStatusBarClock();
                if (viewMode == VIEW_DASHBOARD) {
                    time_t now = time(nullptr);
                    tm t; localtime_s(&t, &now);
                    wchar_t timeBuf[32];
                    wsprintfW(timeBuf, L"%02d:%02d", t.tm_hour, t.tm_min);
                    SetWindowTextW(hDashTime, timeBuf);
                }
            }
            return 0;

        case WM_HOTKEY:
            switch (wp) {
                case 1: ToggleEbook(); break;
                case 2: ToggleExam(); break;
                case 3: DisarmAll(); break;
            }
            return 0;

        case WM_DRAWITEM: {
            DRAWITEMSTRUCT* dis = (DRAWITEMSTRUCT*)lp;
            if (dis->CtlID == IDC_TOOLBAR || dis->CtlID == IDC_SIDEBAR || dis->CtlID == IDC_DASH_FRAME) {
                COLORREF bg = (dis->CtlID == IDC_SIDEBAR) ? theme.sidebarBg :
                              (dis->CtlID == IDC_TOOLBAR) ? theme.toolbarBg : theme.dashBg;
                HBRUSH br = CreateSolidBrush(bg);
                FillRect(dis->hDC, &dis->rcItem, br);
                DeleteObject(br);

                if (dis->CtlID == IDC_TOOLBAR) {
                    HPEN pen = CreatePen(PS_SOLID, 1, theme.toolbarBdr);
                    HGDIOBJ old = SelectObject(dis->hDC, pen);
                    MoveToEx(dis->hDC, 0, dis->rcItem.bottom - 1, nullptr);
                    LineTo(dis->hDC, dis->rcItem.right, dis->rcItem.bottom - 1);
                    SelectObject(dis->hDC, old);
                    DeleteObject(pen);
                }
                return TRUE;
            }
            break;
        }

        case WM_CTLCOLORSTATIC: {
            HDC hdcCtl = (HDC)wp;
            HWND hCtl = (HWND)lp;

            if (hCtl == hDashGreeting || hCtl == hDashDate || hCtl == hDashTime ||
                hCtl == hDashWeatherIcon || hCtl == hDashWeatherTemp ||
                hCtl == hDashWeatherDesc || hCtl == hDashWeatherCity ||
                hCtl == hDashNewsTitle || hCtl == hDashTipTitle || hCtl == hDashTipText ||
                hCtl == hDashSysTitle || hCtl == hDashSysText || hCtl == hDashQuote) {

                SetBkMode(hdcCtl, TRANSPARENT);

                if (hCtl == hDashGreeting) SetTextColor(hdcCtl, theme.textPrimary);
                else if (hCtl == hDashDate) SetTextColor(hdcCtl, theme.textSecondary);
                else if (hCtl == hDashTime) SetTextColor(hdcCtl, theme.accent);
                else if (hCtl == hDashWeatherIcon || hCtl == hDashWeatherTemp)
                    SetTextColor(hdcCtl, theme.weatherText);
                else if (hCtl == hDashWeatherDesc || hCtl == hDashWeatherCity)
                    SetTextColor(hdcCtl, RGB(220, 230, 255));
                else if (hCtl == hDashNewsTitle) SetTextColor(hdcCtl, theme.newsAccent);
                else if (hCtl == hDashTipTitle) SetTextColor(hdcCtl, RGB(161, 98, 7));
                else if (hCtl == hDashTipText) SetTextColor(hdcCtl, RGB(113, 63, 18));
                else if (hCtl == hDashSysTitle) SetTextColor(hdcCtl, RGB(21, 128, 61));
                else if (hCtl == hDashSysText) SetTextColor(hdcCtl, RGB(22, 101, 52));
                else if (hCtl == hDashQuote) SetTextColor(hdcCtl, theme.textSecondary);
                else SetTextColor(hdcCtl, theme.textPrimary);

                for (int i = 0; i < 6; i++) {
                    if (hCtl == hDashNews[i]) {
                        SetTextColor(hdcCtl, theme.textPrimary);
                        break;
                    }
                }

                return (LRESULT)GetStockObject(NULL_BRUSH);
            }

            if (hCtl == hEbInfoLbl || hCtl == hEbPageLbl ||
                hCtl == hExProgress || hCtl == hExResult) {
                SetBkMode(hdcCtl, TRANSPARENT);
                SetTextColor(hdcCtl, theme.textSecondary);
                return (LRESULT)GetStockObject(NULL_BRUSH);
            }

            SetBkColor(hdcCtl, theme.cardBg);
            SetTextColor(hdcCtl, theme.textPrimary);
            return (LRESULT)brCard;
        }

        case WM_CTLCOLOREDIT: {
            HDC hdcCtl = (HDC)wp;
            HWND hCtl = (HWND)lp;
            if (hCtl == hEditor) {
                SetBkColor(hdcCtl, theme.editorBg);
                SetTextColor(hdcCtl, theme.textPrimary);
                return (LRESULT)brEditor;
            }
            break;
        }

        case WM_COMMAND: {
            int id = LOWORD(wp);
            switch (id) {
                case IDM_FILE_NEW:     case IDC_BTN_NEW:   NewNote(); break;
                case IDM_FILE_OPEN:    case IDC_BTN_OPEN:  OpenNote(); break;
                case IDM_FILE_SAVE:    case IDC_BTN_SAVE:  SaveNote(); break;
                case IDM_FILE_EXIT:    PostQuitMessage(0); break;
                case IDM_EDIT_UNDO:    SendMessage(hEditor, EM_UNDO, 0, 0); break;
                case IDM_EDIT_CUT:     SendMessage(hEditor, WM_CUT, 0, 0); break;
                case IDM_EDIT_COPY:    SendMessage(hEditor, WM_COPY, 0, 0); break;
                case IDM_EDIT_PASTE:   SendMessage(hEditor, WM_PASTE, 0, 0); break;
                case IDM_VIEW_SIDEBAR:    ToggleSidebar(); break;
                case IDM_VIEW_FULLSCREEN: ToggleFullscreen(); break;
                case IDM_VIEW_DASHBOARD:  ShowDashboard(); break;
                case IDM_TOOLS_WORDCOUNT: WordCount(); break;
                case IDM_TOOLS_DATETIME:  InsertDateTime(); break;
                case IDM_TOOLS_SETTINGS:  ShowSettings(); break;
                case IDM_HELP_ABOUT:      ShowAbout(); break;
                case IDM_HELP_WEATHER:    RefreshWeather(); break;
                case IDM_HELP_NEWS:       RefreshNews(); break;

                case IDC_BTN_EB_LOAD: EbLoad(); break;
                case IDC_BTN_EB_PREV: EbPrev(); break;
                case IDC_BTN_EB_NEXT: EbNext(); break;

                case IDC_BTN_EX_LOAD:   ExLoad(); break;
                case IDC_BTN_EX_SUBMIT: ExSubmit(); break;
                case IDC_BTN_EX_RESET:  ExReset(); break;
                case IDC_BTN_EX_PREV:   ExPrev(); break;
                case IDC_BTN_EX_NEXT:   ExNext(); break;
            }
            return 0;
        }

        case WM_NOTIFY: {
            NMHDR* nmhdr = (NMHDR*)lp;
            if (nmhdr->hwndFrom == hTreeView && nmhdr->code == TVN_SELCHANGEDW) {
                NMTREEVIEWW* nmtv = (NMTREEVIEWW*)lp;
                if (nmtv->itemNew.hItem && !TreeView_GetParent(hTreeView, nmtv->itemNew.hItem)) {
                    ShowDashboard();
                } else {
                    wchar_t text[256] = {};
                    TVITEMW item = {};
                    item.hItem = nmtv->itemNew.hItem;
                    item.mask = TVIF_TEXT;
                    item.pszText = text;
                    item.cchTextMax = 256;
                    TreeView_GetItem(hTreeView, &item);
                    ShowEditor();
                    SetWindowTextW(hTitleEdit, text);
                }
            }
            break;
        }

        case WM_SETFOCUS:
            if (viewMode == VIEW_EDITOR) SetFocus(hEditor);
            return 0;

        case WM_DESTROY:
            DisarmAll(true);
            KillTimer(hMain, CLOCK_TIMER);
            UnregisterHotKey(hMain, 1);
            UnregisterHotKey(hMain, 2);
            UnregisterHotKey(hMain, 3);
            DeleteObject(fUI);
            DeleteObject(fEditor);
            DeleteObject(fTitle);
            DeleteObject(fBold);
            DeleteObject(fSidebarTitle);
            DeleteObject(fToolbarBtn);
            DeleteObject(fDashGreeting);
            DeleteObject(fDashTime);
            DeleteObject(fDashDate);
            DeleteObject(fDashCardTitle);
            DeleteObject(fDashCardText);
            DeleteObject(fDashWeatherIcon);
            DeleteObject(fDashWeatherTemp);
            DeleteObject(fDashNewsItem);
            DeleteObject(fDashQuote);
            DeleteObject(brSidebar);
            DeleteObject(brToolbar);
            DeleteObject(brDash);
            DeleteObject(brCard);
            DeleteObject(brStatus);
            DeleteObject(brEditor);
            PostQuitMessage(0);
            return 0;
        }
        return DefWindowProcW(h, msg, wp, lp);
    }
};

WNDPROC App::inputOrigProc = nullptr;
bool App::inputDone = false;
bool App::inputOk = false;

// ─────────────────────────────────────────────────────────────────────────────
// WinMain
// ─────────────────────────────────────────────────────────────────────────────
int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, LPWSTR, int nCmdShow) {
    App app;
    if (!app.Init(hInstance, nCmdShow)) return 1;

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    return (int)msg.wParam;
}
