# C++ STL 容器综合对比与高级用法

## 目录
1. [STL容器总览](#stl容器总览)
2. [复杂度对比表](#复杂度对比表)
3. [迭代器详解](#迭代器详解)
4. [通用算法速查](#通用算法速查)
5. [容器适配器](#容器适配器)
6. [pair与tuple](#pair与tuple)
7. [array（C++11）](#arrayc11)
8. [bitset](#bitset)
9. [容器选择决策树](#容器选择决策树)
10. [性能优化技巧](#性能优化技巧)

---

## STL容器总览

### 序列容器
| 容器 | 底层结构 | 特点 |
|------|----------|------|
| `vector` | 动态数组 | 连续内存，随机访问O(1)，尾部插入均摊O(1) |
| `deque` | 分段数组 | 连续分段，首尾插入均摊O(1)，支持随机访问 |
| `list` | 双向链表 | 任意位置插入/删除O(1)，不支持随机访问 |
| `forward_list` | 单向链表 | 只支持前向遍历，内存更少 |
| `array` | 静态数组 | 编译时确定大小，零开销 |

### 关联容器
| 容器 | 底层结构 | 特点 |
|------|----------|------|
| `set` | 红黑树 | 有序去重集合 |
| `multiset` | 红黑树 | 有序可重复集合 |
| `map` | 红黑树 | 有序键值对，键唯一 |
| `multimap` | 红黑树 | 有序键值对，键可重复 |
| `unordered_set` | 哈希表 | 无序去重集合，均摊O(1) |
| `unordered_multiset` | 哈希表 | 无序可重复集合 |
| `unordered_map` | 哈希表 | 无序键值对，键唯一 |
| `unordered_multimap` | 哈希表 | 无序键值对，键可重复 |

### 容器适配器
| 容器 | 默认底层 | 特点 |
|------|----------|------|
| `stack` | deque | LIFO |
| `queue` | deque | FIFO |
| `priority_queue` | vector | 堆，最大元素在顶 |

---

## 复杂度对比表

### 序列容器
| 操作 | vector | deque | list | forward_list | array |
|------|--------|-------|------|--------------|-------|
| 随机访问 | O(1) | O(1) | O(n) | O(n) | O(1) |
| 头部插入 | O(n) | 均摊O(1) | O(1) | O(1) | - |
| 头部删除 | O(n) | 均摊O(1) | O(1) | O(1) | - |
| 尾部插入 | 均摊O(1) | 均摊O(1) | O(1) | O(n) | - |
| 尾部删除 | O(1) | 均摊O(1) | O(1) | O(n) | - |
| 中间插入 | O(n) | O(n) | O(1)* | O(1)* | - |
| 中间删除 | O(n) | O(n) | O(1)* | O(1)* | - |
| 查找 | O(n) | O(n) | O(n) | O(n) | O(n) |

*需已知迭代器位置

### 关联容器
| 操作 | set/map | unordered_set/map |
|------|---------|-------------------|
| 插入 | O(log n) | 均摊O(1)，最坏O(n) |
| 删除 | O(log n) | 均摊O(1)，最坏O(n) |
| 查找 | O(log n) | 均摊O(1)，最坏O(n) |
| 有序遍历 | 支持 | 不支持 |
| 范围查询 | O(log n + k) | 不支持 |

---

## 迭代器详解

### 迭代器分类
```
输入迭代器(Input) → 前向迭代器(Forward) → 双向迭代器(Bidirectional) → 随机访问迭代器(RandomAccess) → 连续迭代器(Contiguous, C++17)
```

### 各容器的迭代器类型
| 容器 | 迭代器类型 |
|------|------------|
| vector | 连续(Contiguous) |
| deque | 随机访问(RandomAccess) |
| array | 连续(Contiguous) |
| list | 双向(Bidirectional) |
| forward_list | 前向(Forward) |
| set/map | 双向(Bidirectional) |
| unordered_set/map | 前向(Forward) |
| stack/queue/priority_queue | 无（容器适配器） |

### 迭代器操作
```cpp
// 前向迭代器
auto it = container.begin();
++it;               // 只能前进
it++;

// 双向迭代器
auto it = container.end();
--it;               // 可前进后退
it--;

// 随机访问迭代器
it + 5;             // 跳跃访问
it - 3;
it += 10;
it[3];              // 下标访问
it1 - it2;          // 距离
it1 < it2;          // 比较

// 迭代器辅助函数（C++11）
#include <iterator>
advance(it, n);     // 移动n步
distance(it1, it2); // 计算距离
next(it, n);        // 返回it后n个位置的迭代器
prev(it, n);        // 返回it前n个位置的迭代器
```

### 迭代器失效规则
| 容器 | 插入后失效 | 删除后失效 |
|------|------------|------------|
| vector | 可能导致realloc时全部失效 | 删除位置之后全部失效 |
| deque | 头尾插入不失效，中间全部失效 | 头尾删除不失效，中间全部失效 |
| list | 不失效 | 仅被删元素的迭代器失效 |
| forward_list | 不失效 | 仅被删元素的迭代器失效 |
| set/map | 不失效 | 仅被删元素的迭代器失效 |
| unordered_* | rehash时全部失效 | 仅被删元素的迭代器失效 |

---

## 通用算法速查

```cpp
#include <algorithm>
#include <numeric>
```

### 排序
```cpp
sort(v.begin(), v.end());                          // 升序
sort(v.begin(), v.end(), greater<int>());          // 降序
stable_sort(v.begin(), v.end());                   // 稳定排序
partial_sort(v.begin(), v.begin() + k, v.end());   // 部分排序，前k个最小
nth_element(v.begin(), v.begin() + k, v.end());    // 第k小元素在正确位置
is_sorted(v.begin(), v.end());                     // 是否有序
```

### 查找
```cpp
auto it = find(v.begin(), v.end(), val);           // 线性查找
auto it = find_if(v.begin(), v.end(), pred);       // 条件查找
auto it = find_if_not(v.begin(), v.end(), pred);   // 条件不满足查找
auto it = lower_bound(v.begin(), v.end(), val);    // 二分查找 >= val
auto it = upper_bound(v.begin(), v.end(), val);    // 二分查找 > val
binary_search(v.begin(), v.end(), val);            // 二分存在性
auto it = search(v.begin(), v.end(), sub.begin(), sub.end()); // 子序列查找
```

### 计数与统计
```cpp
count(v.begin(), v.end(), val);                    // 计数
count_if(v.begin(), v.end(), pred);                // 条件计数
accumulate(v.begin(), v.end(), 0);                 // 求和
accumulate(v.begin(), v.end(), 0LL);               // long long求和
accumulate(v.begin(), v.end(), 1, multiplies<int>()); // 连乘
auto [minIt, maxIt] = minmax_element(v.begin(), v.end()); // 最值
```

### 修改
```cpp
fill(v.begin(), v.end(), val);                     // 填充
fill_n(v.begin(), n, val);                         // 填充n个
iota(v.begin(), v.end(), start);                   // 递增填充
reverse(v.begin(), v.end());                       // 反转
rotate(v.begin(), v.begin() + k, v.end());         // 旋转
shuffle(v.begin(), v.end(), rng);                  // 随机打乱（C++11）
unique(v.begin(), v.end());                        // 去重（需先排序）
remove(v.begin(), v.end(), val);                   // 移除（返回新逻辑末尾）
replace(v.begin(), v.end(), oldVal, newVal);       // 替换
transform(v.begin(), v.end(), result.begin(), func); // 变换
```

### 集合操作（需有序输入）
```cpp
set_union(a.begin(), a.end(), b.begin(), b.end(), out);
set_intersection(a.begin(), a.end(), b.begin(), b.end(), out);
set_difference(a.begin(), a.end(), b.begin(), b.end(), out);
set_symmetric_difference(a.begin(), a.end(), b.begin(), b.end(), out);
includes(a.begin(), a.end(), b.begin(), b.end());  // a是否包含b
```

### 堆操作
```cpp
make_heap(v.begin(), v.end());                     // 建堆
push_heap(v.begin(), v.end());                     // 入堆（先push_back）
pop_heap(v.begin(), v.end());                      // 出堆（再pop_back）
sort_heap(v.begin(), v.end());                     // 堆排序
is_heap(v.begin(), v.end());                       // 是否堆
```

### 排列
```cpp
next_permutation(v.begin(), v.end());              // 下一个排列
prev_permutation(v.begin(), v.end());              // 上一个排列
// 全排列
sort(v.begin(), v.end());
do {
    // 处理排列
} while (next_permutation(v.begin(), v.end()));
```

---

## pair与tuple

### pair
```cpp
#include <utility>

pair<int, string> p;                        // 默认构造
pair<int, string> p(1, "hello");
auto p = make_pair(1, "hello");
auto p = make_pair(1, string("hello"));

p.first;                                    // 访问第一个元素
p.second;                                   // 访问第二个元素

// 结构化绑定（C++17）
auto [a, b] = p;

// 比较（先比first，再比second）
p1 < p2;
p1 == p2;
```

### tuple
```cpp
#include <tuple>

tuple<int, double, string> t;               // 默认构造
tuple<int, double, string> t(1, 3.14, "hi");
auto t = make_tuple(1, 3.14, "hi");

get<0>(t);                                  // 访问第0个元素
get<1>(t);                                  // 访问第1个元素

tuple_size<decltype(t)>::value;             // 元素个数 = 3

// 结构化绑定（C++17）
auto [a, b, c] = t;

// tie解包
int x; double y; string z;
tie(x, y, z) = t;
tie(x, ignore, z) = t;                     // 忽略某些值
```

---

## array（C++11）

```cpp
#include <array>

array<int, 5> arr;                          // 固定大小5，栈上分配
array<int, 5> arr = {1, 2, 3, 4, 5};
array<int, 5> arr{};                        // 零初始化

arr[0];                                     // O(1)访问
arr.at(0);                                  // 带检查访问
arr.front();                                // 首元素
arr.back();                                 // 尾元素
arr.data();                                 // 底层C数组指针
arr.size();                                 // 编译时常量
arr.empty();                                // 始终为false
arr.fill(val);                              // 填充
arr.swap(arr2);                             // 交换

// 可作为函数参数传递，不退化为指针
void foo(array<int, 5>& arr);

// 与C数组对比：
int c_arr[5] = {1, 2, 3, 4, 5};            // 传递时退化为指针
array<int, 5> cpp_arr = {1, 2, 3, 4, 5};   // 不会退化，支持拷贝
```

---

## bitset

```cpp
#include <bitset>

bitset<8> b;                                // 8位，全0
bitset<8> b(42);                            // 从整数构造: 00101010
bitset<8> b("10101010");                    // 从字符串构造

// 位操作
b.set(i);                                   // 设置第i位为1
b.set(i, val);                              // 设置第i位为val
b.reset(i);                                 // 设置第i位为0
b.flip(i);                                  // 翻转第i位
b.set();                                    // 全部设为1
b.reset();                                  // 全部设为0
b.flip();                                   // 全部翻转

// 访问
b[i];                                       // 访问第i位
b.test(i);                                  // 访问第i位（带越界检查）

// 查询
b.count();                                  // 1的个数
b.size();                                   // 总位数
b.any();                                    // 是否有1
b.none();                                   // 是否全0
b.all();                                    // 是否全1（C++11）

// 位运算
b1 & b2;                                    // 与
b1 | b2;                                    // 或
b1 ^ b2;                                    // 异或
~b;                                         // 取反
b << n;                                     // 左移
b >> n;                                     // 右移
b &= b2; b |= b2; b ^= b2; b <<= n; b >>= n;

// 转换
b.to_string();                              // 转字符串
b.to_ulong();                               // 转unsigned long
b.to_ullong();                              // 转unsigned long long（C++11）
```

---

## 容器选择决策树

```
需要存储数据 →
├── 需要有序 →
│   ├── 键值对 → map
│   ├── 集合（去重）→ set
│   ├── 允许重复键 → multimap / multiset
│   └── 需要范围查询 → map / set
│
├── 不需要有序 →
│   ├── 快速查找 →
│   │   ├── 键值对 → unordered_map
│   │   ├── 集合 → unordered_set
│   │   └── 允许重复 → unordered_multimap / unordered_multiset
│   │
│   ├── 序列存储 →
│   │   ├── 固定大小 → array
│   │   ├── 动态大小 →
│   │   │   ├── 主要尾部操作 → vector
│   │   │   ├── 首尾都要操作 → deque
│   │   │   └── 频繁中间插入/删除 → list
│   │   └── 只需前向遍历 → forward_list
│   │
│   └── 特殊需求 →
│       ├── 后进先出 → stack
│       ├── 先进先出 → queue
│       ├── 优先级 → priority_queue
│       └── 位操作 → bitset
│
└── 图结构 →
    ├── 稠密图 → 邻接矩阵
    ├── 稀疏图 → 邻接表
    └── 边操作为主 → 边集数组
```

---

## 性能优化技巧

### vector 优化
```cpp
// 1. 预分配内存，避免多次rehash
vector<int> v;
v.reserve(1000);                    // 一次性分配
for (int i = 0; i < 1000; i++) v.push_back(i);

// 2. emplace_back 替代 push_back（避免临时对象拷贝）
v.emplace_back(args...);

// 3. shrink_to_fit 释放多余内存
v.shrink_to_fit();

// 4. 使用swap技巧释放内存
vector<int>().swap(v);

// 5. vector<bool> 特化（每个元素只占1bit）
vector<bool> flags(1000000);        // 仅占约125KB
```

### unordered_map 优化
```cpp
// 1. 预分配桶
unordered_map<int, int> m;
m.reserve(10000);                   // 避免rehash

// 2. 调整负载因子
m.max_load_factor(0.75);

// 3. 使用try_emplace避免不必要的构造
m.try_emplace(key, value);          // 仅key不存在时构造

// 4. 防哈希冲突攻击（竞赛场景）
// 使用自定义哈希函数（见04文档）
```

### 字符串优化
```cpp
// 1. 使用string_view避免拷贝（C++17）
void process(string_view sv);       // 只读参数

// 2. 预分配
string s;
s.reserve(1000);

// 3. 使用 += 而非 + 拼接
s += str1; s += str2;               // 比 s = s + str1 + str2 高效

// 4. 小字符串优化（SSO）
// string通常对短字符串（<16字符）有栈上优化，无需额外分配
```

### 通用建议
```cpp
// 1. 优先使用栈上容器（array）
array<int, 100> arr;                // 栈分配

// 2. 使用移动语义
vector<int> v = getVector();        // 自动移动
v = move(v2);                       // 显式移动

// 3. 使用emplace系列函数
m.emplace(key, val);                // 就地构造
v.emplace_back(val);
lst.emplace_front(val);

// 4. 批量操作优于循环
v.insert(v.end(), v2.begin(), v2.end()); // 批量插入

// 5. 选择合适的容器大小类型
// 使用size_t或容器的size_type作为索引类型
for (size_t i = 0; i < v.size(); i++) {}
```
