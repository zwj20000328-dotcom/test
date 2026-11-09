# 评审结果（total=62, confirmed=29）

## 1. [confirmed/high] 03-优劣势总结报告.md — §4.1 技术雷达表，第355行
- 说法：「SSD KV 卸载 | 已量产 | LMCache [arXiv:2510.09665]、KVDrive [arXiv:2605.18071]」——KVDrive 被列为已量产。
- 问题：被引论文明确自称「fully functional prototype」，没有任何量产或生产部署证据。把 KVDrive 放进「已量产」行是对被引工作成熟度的事实性误述，会直接影响选型判断。LMCache 摘要也只说企业规模化采用，不等于量产。
- 证据：raw/web/arxiv_raw.json 中 [2605.18071] 摘要：「We have implemented a fully functional prototype of KVDrive and evaluated it on long-context benchmarks with popular LLMs.」全文无 production/deployment 表述；[2510.09665] 摘要仅有「Large-scale adoption of LMCACHE in enterprise settings」。
- 复核理由：我独立核对了 raw/web/arxiv_raw.json 中两条记录，评审者的引用准确无误，且无法通过"语境/表格口径"解释翻案。

1) KVDrive [2605.18071v1] 摘要全文（2026-05-18，cs.CL）：唯一涉及实现成熟度的一句是 "We have implemented a fully functional prototype of KVDrive and evaluated it on long-context benchmarks with popular LLMs." 我对其摘要做了关键词计数：prototype=1，production=0，deploy/deployment=0，industrial=0，commercial=0。正文方法描述也全是"system design + prototype evaluation"，没有任何生产部署、企业采用或线上流量证据。curated-kv-offload-tiered.md [45]、references.md 第793行、02-科研成果调研.md 第50行引用的也都是同一摘要，语料内不存在任何能支撑"已量产"的 KVDrive 证据。

2) LMCache [2510.09665v2] 摘要确实只写 "Large-scale adoption of LMCACHE in enterprise settings"，这一点评审者描述正确；但 raw/web/pages/lmcache.md 显示其有 CoreWeave×Cohere、NVIDIA Dynamo 集成、以及 2026/01 博客 "from experimental feature to production" 等生产侧佐证。所以"把 LMCache 与 KVDrive 同等标为已量产"不成立，但"LMCache 应保留在规模化/生产一档"是站得住的。评审者建议的修法（LMCache=企业规模化采用，KVDrive=原型/早期）恰好没有过度降级 LMCache，方向正确。

尝试反驳的三条路径均不成立：
- "成熟度描述的是技术族（SSD KV 卸载）而非具体论文"——表格结构是"技术｜成熟度｜代表工作｜判断"，其他行（CXL-SSD=原型 列 LM-CXD/TempoKV，光子 CXL=原型）明显用代表工作佐证该行成熟度；读者按行选型时会把 KVDrive 读成量产可用。即便按最宽松口径，把一篇自述 prototype 的论文放进"已量产"行也是引用与成熟度错配，属于误导而非中性列举。
- "报告别处有更准确描述可抵消"——03 报告 §3.2（第167行）自己写的是"早期采用 → 规模化（头部玩家）"，与第355行"已量产"直接冲突，说明第355行是孤立拔高。
- "LMCache 也只是企业采用，所以整行都错、与 KVDrive 无关"——这不构成对 finding 的反驳，只是把问题范围扩大；KVDrive 部分独立成立。

此外该错误不止一处：02-科研成果调研.md 第2020行、raw/web/survey-trend.md 第66行是同一"SSD KV 卸载｜已量产"行，若只改 03 会留下文内不一致（且 survey-trend.md 是 02 的上游产物，不能当作独立佐证）。报告第139行定义的成熟度档位是"实验/早期采用/规模化/标准化"，"已量产"本就不在该口径内，修正时顺带统一为"规模化/原型"更稳。

综上：被质疑的"KVDrive 被列为已量产"是可用原始摘要直接证伪的事实性误述，影响选型判断，维持 high。
- **修正**：将 03-优劣势总结报告.md 第355行整行替换为：

| SSD KV 卸载 | 规模化（LMCache）/ 原型（KVDrive） | LMCache [arXiv:2510.09665]、KVDrive [arXiv:2605.18071] | 默认方案；下一道坎是寿命。KVDrive 论文仅报告原型，无生产部署证据 |

（若希望判断栏保持原句不变，可改为：

| SSD KV 卸载 | 规模化（LMCache）/ 原型（KVDrive） | LMCache [arXiv:2510.09665]（企业规模化采用）、KVDrive [arXiv:2605.18071]（论文自述为 fully functional prototype） | 默认方案；下一道坎是寿命 |

同一错误还在两处，应同步替换以保持全文一致：
- 02-科研成果调研.md 第2020行 → `| SSD KV 卸载 | 规模化（LMCache）/ 原型（KVDrive） | [arXiv:2510.09665][arXiv:2605.18071] | 默认方案；下一道坎是寿命而非带宽（KVDrive 仅原型，无生产证据） |`
- raw/web/survey-trend.md 第66行为上游原始产出，可保留不改，但不应再被当作该结论的独立佐证；若报告引用它，需按上两行口径重述。

注意：不要把 LMCache 一并降级——其生产侧证据（CoreWeave×Cohere、NVIDIA Dynamo 集成、2026/01 "from experimental feature to production"）在 raw/web/pages/lmcache.md 中可查。"已量产"一词也不在报告第139行定义的档位（实验/早期采用/规模化/标准化）内，建议统一为"规模化/原型"。

## 2. [confirmed/medium] 03-优劣势总结报告.md — §4.1 技术雷达表，第358行
- 说法：「CXL 内存池 | 试点 | Beluga [arXiv:2511.20172] | 需 512 GiB 级设备与 K8s 调度」——把 512 GiB 与 K8s 要求挂在 Beluga 名下。
- 问题：512 GiB CXL 设备与 Kubernetes DRA 调度这两个条件来自另一篇论文 [arXiv:2609.10790]（Composable CXL Memory as a Kubernetes-Native Shared Memory），不是 Beluga。Beluga 摘要未提 512 GiB，也未提 Kubernetes。02 中同一表格同时引用了两篇，03 删掉了第二篇，造成张冠李戴。
- 证据：Beluga [2511.20172] 摘要只描述「a commercial CXL switch-based memory pool」，无 512 GiB/K8s；raw/web/survey-memory-hierarchy-hw.md 第15行注明 Beluga「摘要未给出量化数字」；02-科研成果调研.md 第515、2023行明确把「512 GiB CXL + K8s DRA」归给 [2609.10790]。
- 复核理由：读原始材料后无法反驳，评审意见成立。

1) Beluga [2511.20172] 摘要原文（d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json 第37293–37294行，以及 curated-memory-hierarchy-hw.md 第43–46行）通篇只讲 "access a shared, large-scale memory pool through CXL switches"、"a commercial CXL switch-based memory pool"，没有任何容量数字，也没有出现 Kubernetes/DRA/调度。报告自己的 raw/web/survey-memory-hierarchy-hw.md 第15行还专门注明 Beluga「摘要未给出量化数字」，第74行表格同样写「摘要未给数字」。因此把 "512 GiB 级设备" 和 "K8s 调度" 挂在 Beluga 名下，在报告自定的 A 级证据（摘要原文）标准下达不到。

2) 这两个条件精确对应 [2609.10790]：arxiv_raw.json 第18552–18553行的标题即 "Composable CXL Memory as a Kubernetes-Native Shared Memory for LLM Serving"，摘要写 "a Kubernetes Dynamic Resource Allocation (DRA) driver that makes composable CXL memory a schedulable cluster resource" 与 "a two-node cluster with a 512 GiB CXL appliance"。两项事实一一对应，不存在第三种来源。

3) 同表在 02-科研成果调研.md 第2023行是「CXL 内存池 / 可组合共享内存 | 试点 | [arXiv:2511.20172][arXiv:2609.10790] | K8s 原生调度是分水岭；需 512 GiB 级设备才划算」，两篇并列；raw/web/survey-trend.md 第69行同样两篇并列。03 第358行只保留了 Beluga 一篇，删掉 2609.10790 后判断句失去归属，属于事实层面的引用张冠李戴（数字和机制本身没错，错在归属）。

4) 我尝试过两种可能的反驳，均不成立：(a) 若主张"判断列是报告自身的综合推导、不必逐条对应代表工作"，则 512 GiB 这个具体阈值与 K8s DRA 这个具体机制在全文找不到任何支撑句——03 中 2609.10790 出现次数为 0，§3.3（第155–181行）整节无引用，第181行「适用：512 GiB 级以上共享池」同样无出处，反而说明该数字是外部借用而未标注；(b) 若主张 512 GiB 是通用经验值，则摘要并未给出任何"低于此不划算"的论证，报告也未给出推导，属于无源断言。

严重度 medium 合适：不是硬性事实错误（该判断对 2609.10790 成立），但会影响读者对 Beluga 贡献边界与 CXL 落地门槛来源的判断。

最小修法：恢复 02/survey-trend 的两篇并列写法；同时建议 §3.3 第181行的 512 GiB 阈值补同一引用。
- **修正**：替换 03-优劣势总结报告.md 第358行整行（保持原表格风格）：

| CXL 内存池 | 试点 | Beluga [arXiv:2511.20172]、CXL-K8s [arXiv:2609.10790] | K8s 原生 DRA 调度；需 512 GiB 级共享池才划算 |

可选：同步修正 §3.3（第181行），把无出处的阈值挂上来源：

**成熟度**：实验 → 早期。**适用**：512 GiB 级以上共享池（[arXiv:2609.10790] 的两节点可行性验证口径）、Engram/稀疏表。**不适用**：高带宽 decode。

若只做一处最小改动，仅在第358行代表工作列补 "、CXL-K8s [arXiv:2609.10790]" 即可完全消除张冠李戴，判断句无需改写。

## 3. [partially/medium] 03-优劣势总结报告.md — §3.7 劣势，第234行（同述见 01-领域全景与技术图谱.md §4.4 第96、100行）
- 说法：「PD 分离收益从 7× 收敛到 1.2–1.5×」。
- 问题：抓取语料中没有工作报告 1.2–1.5× 的 PD 分离收益；7× 来自 DistServe 的 7.4×，其 SLO/硬件/基线与「1.2–1.5×」并非同一口径，不能拼成一条「收敛」曲线。该写法还与报告第133行「跨论文比较没有意义」自相矛盾。
- 证据：arxiv_raw [2401.09670] DistServe 摘要：「can serve 7.4x more requests or 12.6x tighter SLO」；对 survey/curated/02 全量检索「1.2–1.5 / 1.2-1.5」无任何命中。
- 复核理由：原文确实存在：`03-优劣势总结报告.md` 第234行「收益从 7× 收敛到 1.2–1.5×」，`01-领域全景与技术图谱.md` 第96行标题与第100行同述。核对原始材料后，核心缺陷成立，但评审者的一条关键证据不成立，故判 partially。

成立的部分：
1. 7× 可追溯到 DistServe [2401.09670] 摘要「can serve 7.4x more requests or 12.6x tighter SLO」，但这是「在 TTFT/TPOT 约束下、相对 SOTA 系统的请求率/goodput」，与「1.2–1.5×」不是同一指标；03:234 也没有给出 1.2–1.5× 的任何出处。
2. 跨论文拼接确与报告自身矛盾：03 第133行明写「跨论文比较没有意义」，`00-方法论与证据说明.md` 第65行也写「跨论文直接比较加速比是没有意义的」，§2.3 还要求论文数字「标注论文声称、不跨论文比较」。03:234 既无引用也无口径标注。
3. 「收敛」在时间上也不成立：Splitwise [2311.18677]（2023-11）报告「1.4x higher throughput at 20% lower cost」，DistServe（2024-01）报告 7.4×，两者几乎同期且口径不同；`raw/analysis-quant.md` 第278行自己也写成「Splitwise/DistServe 报告的 1.4×–7× 收益」，是区间而非收敛曲线。

不成立的部分：
评审者说「抓取语料中没有工作报告 1.2–1.5× 的 PD 分离收益」过于绝对。Splitwise 摘要的 1.4× 落在该区间，且 Splitwise 就是 PD 相位分离工作；`raw/kv-disagg-sched.json` 第66行附近对 Llumnix 的注记写着「吞吐提升（约 1.2-1.5 倍量级），具体数值记忆不精确」。不过这两个锚点都救不了原句：Llumnix 注记是二手且自述「记忆不精确」，其摘要实为「high-priority requests up to 1.5x、尾延迟一个数量级、36% cost savings」，且 Llumnix 是动态重调度而非 PD 分离；Splitwise 的 1.4× 是吞吐/成本口径。它们恰好证明同期口径差异巨大，不能支撑「7×→1.2–1.5×」的收敛叙事。

结论：缺陷本身成立，medium 合理；但证据句应改为「Splitwise 1.4× 与 DistServe 7.4× 口径不同、同期并存」，而不是「没有任何工作报告」。最小修法仍是删除数字轨迹、保留定性判断。
- **修正**：03-优劣势总结报告.md 第234行，替换为：
- 收益高度依赖 SLO、模型与负载，跨论文数字不可比（DistServe 的 7.4× 是 TTFT/TPOT 约束下的请求率，Splitwise 的 1.4× 是吞吐/成本口径）；

01-领域全景与技术图谱.md 第96行标题，替换为：
### 4.4 PD 解耦与调度：收益取决于 SLO，跨论文数字不可比

01-领域全景与技术图谱.md 第100行，替换为：
**现状**：PD 分离已是事实标准，但收益高度依赖 SLO、模型与负载：DistServe 在自身 TTFT/TPOT 约束下报告 7.4× 请求率 [arXiv:2401.09670]，Splitwise 以吞吐/成本口径报告 1.4× [arXiv:2311.18677]，两者不可拼成一条「收敛」曲线；下一波竞争在 **KV-aware routing** 与全局 KV 目录，而不是再拆一次 prefill/decode。

## 4. [confirmed/medium] 03-优劣势总结报告.md — §2 发现3，第83行
- 说法：「前缀感知去重能显著削减写量」。
- 问题：被引论文的结论只对 exact-repeat 负载成立，其余三类负载写量仍在 2–5 GB；报告删掉了这一限定，把单负载结论写成一般结论（过度外推）。
- 证据：[2610.21249] 摘要原文：「deduplication delivers a dramatic write reduction only for the exact-repeat workload: one set collapses from 1.62 GB to 11.75 MB of writes, while the other three sets remain in the 2-5 GB range.」
- 复核理由：独立核对后，评审意见成立，且实际比评审描述的还要多一处错误。

1) 原文定位无误：d:/xiaojun/work/test/StoreAI/research/03-优劣势总结报告.md 第83行末句为「反过来，前缀感知去重能显著削减写量，但前提是页缓存仍然温热——一旦被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。」该句对「去重削减写量」只挂了 [arXiv:2610.21249] 一个引用，没有其他文献支撑。

2) 被引论文摘要原文逐字核实：d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json 中 id=2610.21249v1（Characterizing Predictability-Latency Trade-offs of KV-Cache SSD Offloading in LMCache for LLM Serving Systems，2026-10-15）明确写「Second, deduplication delivers a dramatic write reduction only for the exact-repeat workload: one set collapses from 1.62 GB to 11.75 MB of writes, while the other three sets remain in the 2-5 GB range.」论文自己的工作负载是 same/different context × same/different prompt 四种，只有 exact-repeat 一种出现量级下降，另外三种停在 2-5 GB。报告删去「only for the exact-repeat workload」与三类负载的限定，把单负载结论写成一般结论，属于过度外推，评审判断正确。我另外检索了 arxiv_raw.json 全部 1877 篇摘要中同时含 dedup 与 write/SSD/KV 的条目，只有 2610.21249 涉及 KV 落盘去重的写量，gKSM（2610.25219）是 GPU 显存去重、与 SSD 写量无关，因此不存在能支撑该一般化表述的其他证据。

3) 评审的修法方向正确但仍不完整，原文还有第二处事实性混淆：「但前提是页缓存仍然温热」被接在「去重削减写量」之后，读起来成了去重写收益的前提。但摘要把 page-cache warmth 归为第一条发现，讲的是 legacy 0.3.0（buffered I/O + 内核页缓存）「几乎不读 SSD」的表象，且「一旦逐出，683 ms 内约 1 GB 顺序读」说的是读，不是写；而报告所指的去重版本是 0.3.16（prefix-aware dedup + O_DIRECT），O_DIRECT 本身就绕过页缓存。把页缓存温度写成去重写削减的前提，既错置了因果，也错置了读/写。只按评审给的文本替换首句，会留下这个悬空的错误限定。

4) 同一错误表述并非孤例，建议同步修改以下位置（同一句式/同一错误）：d:/xiaojun/work/test/StoreAI/research/02-科研成果调研.md 第109行（「同时 prefix-aware 去重带来显著写下降」）与第1963行（与03第83行完全相同）；d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md 第155行（「前缀去重能显著削减写量，但依赖 page cache 温热」）；d:/xiaojun/work/test/StoreAI/research/raw/web/survey-trend.md 第9行（同03第83行句式）。

严重度维持 medium 合理：数字本身没错，错在把带单负载限定的实测结论外推为一般结论，并附带一处因果/读写混淆。需要说明的是，1.62 GB→11.75 MB 严格说是 0.3.0 与 0.3.16（dedup+O_DIRECT 打包）两个部署快照的对比，但摘要本身即以 deduplication 归因，报告沿用论文措辞可以接受，不构成额外问题。
- **修正**：替换 d:/xiaojun/work/test/StoreAI/research/03-优劣势总结报告.md 第83行末句（原句：「反过来，前缀感知去重能显著削减写量，但前提是页缓存仍然温热——一旦被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。」）为：

反过来，前缀感知去重的写量削减只对 exact-repeat（同上下文、同 prompt）负载显著，该组写入从 1.62 GB 降到 11.75 MB，其余三类负载写量仍在 2–5 GB；而「几乎不读 SSD」只是 legacy 栈在页缓存温热时的假象——一旦缓存被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。

同步替换（同一错误表述）：
- d:/xiaojun/work/test/StoreAI/research/02-科研成果调研.md 第109行末段改为：「同时 prefix-aware 去重只在 exact-repeat 负载下带来显著写下降（1.62 GB→11.75 MB），其余三类负载写量仍在 2–5 GB。」
- d:/xiaojun/work/test/StoreAI/research/02-科研成果调研.md 第1963行、d:/xiaojun/work/test/StoreAI/research/raw/web/survey-trend.md 第9行：套用上面 03 第83行的替换句。
- d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md 第155行改为：「前缀去重只在 exact-repeat 负载下显著削减写量（1.62 GB→11.75 MB），其余三类负载写量仍在 2–5 GB；legacy 栈「几乎不读 SSD」依赖 page cache 温热，一旦逐出，683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。」

## 5. [partially/medium] 01-领域全景与技术图谱.md — §4.2 关键判断，第86行
- 说法：「token 级驱逐的压缩率长期停在约 5×」。
- 问题：抓取集合中没有任何摘要给出「5× 平台期」。H2O 甚至不在 1,877 条语料中，而 05-参考文献与索引.md 第177行称其「无 arXiv 版本」，但 H2O 实为 arXiv:2306.14048。survey 中的工作点跨度从 2% 预算（≈50×）到 75–88% 压缩（≈4–8×）再到 15–25% 内存（≈4–7×），「停在 5×」既不准确也无法追溯。
- 证据：raw/web/survey-kv-compression.md 第25行（RULER 16K、2% KV 预算）、第114行（KVpop 75%/88% 压缩）、第40行（Lexico 15–25% 内存）；数据集查询 2306.14048 返回 NOT FOUND，无法核验 5×。
- 复核理由：判 partially：核心问题成立，但评审者的证据链与定级有两处需要修正。

一、核心成立。01:86 把「H2O/SnapKV 一类在保留 20%（约 5×）时精度基本不变」写成「token 级驱逐的压缩率长期停在约 5×」。报告自己的 raw/analysis-quant.md:138 原文是「H2O/SnapKV 一类报告在 5× 压缩（保留 20%）时精度基本不变……不能把 5× 当作通用常数」；§4.2 恰恰删掉了后半句。抓取集合也不支持「平台」：survey-kv-compression.md:25 的 KV² 报 2% 预算（≈50×），:114 的 KVpop 报 75%/88% 压缩（≈4×/8×）且保留 98%/97%，:40 的 Lexico 报 15–25% 内存（≈4–7×）且保 90–95%。因此「停在 5×」确实不准确，medium 定级对 §4.2 成立。

二、「无法追溯」不准确。5× 在 raw/analysis-quant.md:138 与 raw/kv-compression.json:24 都有出处；问题是这两处都是内部一阶模型/记忆条目，且自带「可能记忆有偏差」「不能当通用常数」的免责，§4.2 又未标注来源。准确说法是「不能由抓取摘要核验，且被自身来源限定」，不是「无法追溯」。

三、H2O 的核验。arxiv_raw.json 确实没有 2306.14048（1,877 条中 0 命中），但 raw/kv-compression.json:17-28 有 H2O 条目（confidence A，evidence_note 承认 5× 设置可能记错）。我直接查 arXiv API：2306.14048 存在，标题为 H$_2$O: Heavy-Hitter Oracle...，2023-06-24 提交、v3 2023-12-18；摘要写的是「20% heavy hitters」，吞吐最高 29×/29×/3×、延迟 1.9×，并未直接写「5× 压缩」——5× 是从 20% 预算反推的。所以 5× 本身可核验，不可核验的是「平台期」；评审者把两者混为一谈。另，raw/kv-compression.json:24 把吞吐写成 +20%、延迟 −29%，与摘要的 29×/1.9× 不符，说明该内部条目不宜作为 A 级依据。

四、H2O 缺失的根因。05:177 与 README:99 把 H2O 列入「无 arXiv 版本」是独立的事实错误，应按 high 处理，而不是并进这条 medium。缺失的直接原因是标题归一化：arXiv 标题为 H$_2$O，norm() 后变成「h 2 o」，fix_classics.py / restore_classics.py 均报「no confident match」（见 raw/web/fix_classics.log、restore_classics.log）。

五、评审者的建议文本「常见工作点在保留约 20%」仍把 20% 说成「常见」，抓取集合没有给出这个分布；且「2%–25% 预算」把保留比例与压缩比混写，应写成「保留 2%–25%（约 4–50×）」。建议只陈述有出处的具体工作点（H2O/SnapKV），再列已报告预算。

另：00:40 写「1,866 篇去重论文」，而 arxiv_raw.json 实为 1,877（restore_classics.log: restored 11, total 1877）；这是独立的计数不一致，建议同步，不影响本条结论。
- **修正**：【01-领域全景与技术图谱.md 第86行，整句替换】
**关键判断**：H2O/SnapKV 一类报告在保留约 20%（约 5×）时精度基本不变（H2O 的 20% heavy-hitter 设置即属此列 [arXiv:2306.14048]），但这不是长期平台——KV² 在 RULER 16K 上报告 2% 预算（约 50×）[arXiv:2610.03198]，KVpop 报告 75%/88% 压缩（约 4×/8×）且保留 98%/97% [arXiv:2607.05061]，Lexico 仅用 15–25% 内存（约 4–7×）并保持 90–95% 性能 [arXiv:2412.08890]，检索/多跳任务上掉点仍然明显；量化与编码的"压缩比–精度"前沿高度重合，甚至组合不叠加（[arXiv:2610.33076] 报告 FP4 与 Polar 串联后在两个维度都劣于单用 FP4）。**真正的杠杆已经转向架构级（GQA/MLA）与存储级（可检索 KV、量化格式），而不是又一个驱逐策略。**
（注：00 要求综述引用必须存在于抓取集合；请先按下方修法把 2306.14048 补入 arxiv_raw.json，再落这条引用。）

【05-参考文献与索引.md 第177行，整条替换】
1. **无 arXiv 版本的经典**：Orca (OSDI'22)、DiskANN (NeurIPS'19)、CheckFreq (FAST'21)、Gemini (SOSP'23)、AttentionStore、3FS 论文（若存在）。这些工作在正文中以名称引用，未给 arXiv ID。**H2O 不在此列：已核实为 [arXiv:2306.14048]（v3，2023-06-24；NeurIPS 2023），应补入正文引用与文献表。**

【README.md 第99行，替换】
- 以 arXiv 为主，无 arXiv 版本的经典（Orca、DiskANN、3FS 论文）与国内期刊覆盖不足；H2O 已核实为 [arXiv:2306.14048]，需补入语料。

【补语料的可操作修法】raw/web/arxiv_raw.json 缺 2306.14048 的直接原因是标题归一化：arXiv 标题为 `H$_2$O: ...`，`re.sub(r'[^a-z0-9]+',' ',s.lower())` 得到 `h 2 o ...`，与 `H2O` 不匹配；`tools/fix_classics.py` 与 `tools/restore_classics.py` 均报 `! H2O: no confident match`（见 raw/web/fix_classics.log、raw/web/restore_classics.log）。建议在 `norm()` 中先剥离 `$`、`_`、`{}` 等 LaTeX 记号，或对 H2O 使用显式 ID 覆盖；重跑后把 2306.14048 追加到 arxiv_raw.json，并在 raw/web/survey-kv-compression.md 中引用一次，再运行 tools/build_references.py 生成 05a-完整文献表.md。

## 6. [confirmed/medium] 01-领域全景与技术图谱.md — §4.5 反直觉事实，第106行
- 说法：「1024 GPU 的 LLM token 流聚合只有 12–50 MB/s；元数据压力约 820 万 ops/s」被标为「反直觉事实」。
- 问题：这两个数是 raw/analysis-quant.md §5.1–5.2 的一阶模型输出，依赖 q=3000 tok/s/GPU、q=2000 sample/s/GPU 等假设；01 把它写成「事实」，且该节没有像 §2 那样提示「见 analysis-quant.md」，读者会误以为是实测。
- 证据：raw/analysis-quant.md 第6行：「全部数字来自一阶解析模型 + 公开规格的近似值，不是实测」；第525–542行表格显示 12/49 MB/s 由 1024×3000×4B/16B 算出，820 万 ops/s 由 1024×2000×4 算出。
- 复核理由：独立核对结果支持该评审意见，且问题比评审者所述还多一层。

1) 数字来源核实：`raw/analysis-quant.md` 第6行明确写「全部数字来自一阶解析模型 + 公开规格的近似值，不是实测」；§5.1 表格（525–526行）给出 1024×3,000 tok/s×4 B = 12 MB/s、×16 B = 49 MB/s，§5.2（542行）给出 1024×2,000 sample/s×4 ops = 820 万 ops/s。我复算：1024×3000×4/1e6 = 12.29 MB/s，1024×3000×16/1e6 = 49.15 MB/s，1024×2000×4 = 8,192,000 ops/s，与原文一致。全仓检索（`raw/` 下所有 .md/.json）显示这组数字只出现在 analysis-quant.md 及其在 01 的转述中，没有任何实测或论文出处。

2) 「引用的 arXiv 摘要」不存在：01 §4.5 只提到 3FS（DeepSeek，2025 开源），未给 arXiv ID。在 `raw/web/arxiv_raw.json`（1,877 条）中按标题精确检索 "Fire-Flyer"/"3FS" 命中 0 条；`raw/industrial-systems.json` 自己把 3FS 标为 B 级 GitHub 文档、并注明「未在 FAST/OSDI 正式发表」。因此无法用摘要为这两个数背书，评审者也没有误读摘要或混淆工作。

3) 上下文提示缺失属实：01 第19行「完整的推导与算例见 raw/analysis-quant.md，这里只列结论」位于 §2 开头，作用域是 §2 的四个事实；§4.5 自成一个研究簇，既无该提示也无假设标注，却以「反直觉事实」开头，确实容易被读成实测。

4) 评审者未指出的加强点：820 万 ops/s 用的是 2,000 sample/s/GPU，而同一句前半段的 LLM token 流用的是 3,000 tok/s/GPU。按每样本 8K token 折算，LLM 的样本率不足 1 sample/s/GPU，2,000 sample/s/GPU 是 analysis-quant §5.1 表中图像分类/小文件负载的口径。01 把它直接接在「LLM token 流」之后，属于负载混用，读者会以为这是 LLM 训练的元数据压力。修正文本需要同时澄清这一点。

5) 我尝试的反驳理由：00 §2.3 与 §6.6 确实全局声明「本报告推导值来自 analysis-quant.md 的一阶模型、仅用于数量级论证」。但这只是文档级免责声明，不能替代 01 §4.5 的局部标注，且「事实」一词与「标注假设」的要求（00 §2.3 第3类）直接冲突。按任务给出的分级，这是「表述过强/证据不足」的 medium，不是 high（算式与量级本身正确）。故判 confirmed。
- **修正**：将 `d:/xiaojun/work/test/StoreAI/research/01-领域全景与技术图谱.md` 第106行整段替换为：

**反直觉事实（一阶估算，假设 3000 tok/s/GPU、4–16 B/token，推导见 `raw/analysis-quant.md` §5）**：1024 GPU 的 LLM token 流聚合只有 **12–50 MB/s**；真正打爆存储的是**元数据**（小文件负载按 2000 sample/s/GPU × 1024 × 4 ops ≈ 820 万 ops/s）与 **checkpoint**（比数据加载高 10³–10⁴ 倍 bytes/FLOP）。把"LLM 训练存储瓶颈"归因于"数据读不动"是常见错误。

## 7. [partially/high] 04-研究方案提案.md — P3 · 创新点/基线/预期结果（L171、L179、L184）
- 说法：P3 把“写多少 KV”与命中率、读取带宽、SSD 寿命放进同一目标，预期在命中率损失 <5% 下把 SSD 寿命延长 2–4×；相对 Gandalf 的增量是“统一的寿命-命中-带宽三元优化与 TBW 预算 API”。
- 问题：核心机制已被 Gandalf 覆盖，且预期寿命增益低于 Gandalf 已报告的 7.3×；基线还用“Gandalf 类门控”代替 Gandalf 本身，无法证明增量。写入门控本身也已被 2609.07175 的 admission-controlled LRU-K 实现。
- 证据：Gandalf（arXiv:2610.30791）摘要：“the first SSD KV cache offloading system with SSD life time awareness... extends the SSD lifetime by 7.3X on average, while having negligible impact on cache hit rate”；2609.07175 摘要：“LRU-K decouples KV cache writes from misses”。P3 L184 的目标 2–4× 严格低于 7.3×。
- 复核理由：我核对了 `d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md` L171/L179/L184，以及 `raw/web/arxiv_raw.json` 中 2610.30791v1（Gandalf）与 2609.07175v1 的原始摘要。结论是：评审的一半成立，另一半把摘要读过头了。

【成立的部分（必须改）】
1. 数字确实被压制。Gandalf 摘要原文：“extends the SSD lifetime by 7.3X on average, while having negligible impact on cache hit rate”，且明确是 “the first SSD KV cache offloading system with SSD life time awareness”。P3 L184 写“寿命延长 2–4×”，在未标注基线的情况下，最自然的读法就是相对无门控/LRU 的绝对增益，严格低于 7.3×。这意味着提案自己设定的预期结果被一篇已发表系统在同一指标上支配，却没有一句解释。
2. 基线确实不诚实。L179 用“Gandalf 类门控”“SARIA 类选择性持久化”，而 Gandalf 与 SARIA 都是已公开的具体系统（SARIA 还明确在 LMCache MP 上实现）。用“类”代替本体，无法证明相对 SOTA 的增量，这是评审最扎实的一条。
3. 2609.07175 确实已做写入门控。摘要：“we evaluate a write-aware KV cache policy based on admission-controlled LRU-K... By filtering low-reuse users before cache admission, LRU-K decouples KV cache writes from misses”，并把 HBF 寿命从约 1 年提到 6 年以上（约 6×）。P3 在 L154 已引用它作为问题证据，却在创新点里完全没提，属于漏掉最接近的先行工作。
4. 旁证：`02-科研成果调研.md` L141 把 Gandalf 的摘要写成“摘要未给出具体数字”，与原文 7.3× 直接矛盾。说明 04 的 2–4× 是建立在低估基线之上，不是有意的保守设定。

【不成立/过头、不能照单全收的部分】
A. “核心机制已被 Gandalf 覆盖”不成立。Gandalf 的机制是“按 attention 类型优先接纳 full-attention KV”，其摘要反而明确批评“仅按历史访问模式 gate 会显著降低命中率”。P3 L164 的“复用概率×收益/写入成本”打分属于通用价值型 admission，与 Gandalf 不是同一机制；P3 的“读带宽成本项”和“TBW 预算 API”在 Gandalf 摘要中均无对应。准确的指控应是“P3 未证明自己不是 Gandalf 的弱化版”，而不是“机制已被覆盖”。
B. “写入门控已被 2609.07175 实现”过头。该工作是 HBF + 生成式推荐（GR）场景，不是 SSD offloading + LLM serving；“admission-controlled LRU-K”是过滤低复用用户，与 P3 的寿命/带宽联合打分有交集但不重合。真正的问题是 P3 没在创新点里划清界限，不是被完全抢先。
C. 评审建议的修法“把目标改为超过 7.3×”不合理。7.3× 是 Gandalf 在其自身 trace 与“wide range of hardware capacity”上的平均值，不是可跨工作负载移植的承诺值。要求提案无条件承诺 >7.3× 在方法学上站不住脚；正确做法是头对头、同 trace 同介质下的相对增益。
D. L184 的 2–4× 未写明基线，本身有歧义：若它是“相对 Gandalf 再延长 2–4×”，则总增益为 14.6–29.2×，反而超过 7.3×。评审把它直接读成绝对增益是一种合理但非唯一的解读。因此这条应判“表述歧义导致的可疑”，修法是显式写基线，而不是简单把数字调大。

综上：数字与基线两条硬伤成立，机制覆盖与“必须超过 7.3×”两条不成立，故判 partially。严重度维持 high——不是因为机制被覆盖，而是因为“预期结果低于已发表 SOTA + 无真实基线”足以让审稿人直接拒稿。
- **修正**：按原文风格，直接替换以下三处（L171、L179、L184–L186）：

【替换 L171 及其后新增一条】
- vs Gandalf [arXiv:2610.30791]：Gandalf 按 attention 类型优先接纳 full-attention KV，在多个 trace 与硬件容量上平均把 SSD 寿命延长 **7.3×**、命中率影响可忽略；P3 不重复该门控，而是在其之上引入**读带宽价格项**与**可配置 TBW 预算 API**，并给出跨租户/跨模型的全局配额（Gandalf 未涉及多租户）；
- vs admission-controlled LRU-K [arXiv:2609.07175]：该工作在 HBF + 生成式推荐中用“过滤低复用用户”解耦写入与 miss（HBF 寿命约 1 年→6 年以上）；P3 把 admission 分数扩展为“复用收益/写入成本 + 读带宽成本”，并面向 SSD offloading 与介质差异（ZNS/OP）重新标定；

【替换 L179】
- 基线：LRU、**Gandalf [arXiv:2610.30791]**（优先作者实现；不可得则按其论文策略忠实复现并在文中标注）、**SARIA [arXiv:2610.31169]**、**admission-controlled LRU-K [arXiv:2609.07175]**、无门控；不以“Gandalf 类/SARIA 类”替代真实系统，否则无法证明相对 SOTA 的增量。

【替换 L184–L186】
- 与 Gandalf 在**相同 trace、相同 SSD 型号与容量**上头对头：命中率损失 <5% 时，写入量再降 **30–50%**，寿命增益相对 Gandalf 再提高 **1.5–2×**；
- 相对**无门控基线**，SSD 寿命延长 **2–4×**（该绝对值不与 Gandalf 的 7.3× 直接可比：7.3× 是其自身 trace 与硬件上的平均值，本文报告同条件相对增益）；
- 若头对头未能超过 Gandalf，则论文定位调整为“多租户 TBW 预算与带宽感知 admission”，以配额隔离与预算可证明性为主贡献；
- 给出可复用的 TBW 预算模型（论文贡献）。

【配套修正，否则前后矛盾】`02-科研成果调研.md` L141 中 Gandalf 一行的“摘要未给出具体数字”应改为“平均 7.3× 寿命提升，命中率影响可忽略”。

## 8. [confirmed/high] 04-研究方案提案.md — P10 · 核心洞察/技术路线/创新点/基线/预期结果（L551、L555–557、L563、L571、L576）
- 说法：P10 的核心洞察是“CXL 的价值在设备参与语义决策”，技术路线 1–2 是设备可见 chunk + claim/commit，预期相对 stock CXL-SSD 提升 2–3×。
- 问题：LM-CXD 已实现同样的设备可见 chunk、NAND→DRAM 进度上报和设备 DRAM 缓冲，并报告 2.6–4.03× TTFT 提升；TempoKV 已实现 claim/commit。P10 的预期低于 SOTA，基线又排除了这两个系统。
- 证据：LM-CXD（arXiv:2609.26828）：“makes KV chunks device-visible I/O units, exposes NAND-to-DRAM progress to the serving engine, and uses device DRAM as a GPU-accessible buffer... reduces average TTFT over a stock CXL-SSD by up to 2.6×...4.03×”；TempoKV（arXiv:2609.35065）：“records reusable-KV hits as metadata-only claims and requests commitment”。
- 复核理由：逐条核对 raw/web/arxiv_raw.json 的完整摘要后，评审者的关键事实全部成立，且比其引述更强。

1) LM-CXD（2609.26828v1，标题 "Bridging LLM Serving and CXL-SSDs with Chunk-Aware KV Cache Management"）摘要原文："It makes KV chunks device-visible I/O units, exposes NAND-to-DRAM progress to the serving engine, and uses device DRAM as a GPU-accessible buffer." 以及 "reduces average TTFT over a stock CXL-SSD by up to 2.6× with compute asynchronous prefetching and 4.03× with layerwise prefetching, achieving TTFT within 1.5× of local DRAM on average." 与评审引述逐字吻合。

2) TempoKV（2609.35065v1）摘要原文："records reusable-KV hits as metadata-only claims and requests commitment when ... commitment remains subject to available protected capacity." 即 claim/commit + 受保护容量，与 P10 L556 "元数据认领 + 到期提交；设备维护受保护容量" 几乎逐字对应。

3) P10 的重复不是"疑似"而是文本级重合：L551 的核心洞察（设备参与语义决策）就是 LM-CXD 摘要的 "bridges the semantic gap between the serving engine ... and the device"；L555 路线 1 与 LM-CXD 的设备可见 chunk/NAND→DRAM 进度逐项对应；L556 路线 2 与 TempoKV 的 claim/commit/受保护容量逐项对应。更关键的是，P10 在 L544 已经引用了同一篇 2609.26828，但只取了"stock CXL-SSD 慢 3×"这一 characterization 结论，没有把其系统贡献计入创新点；而 02-科研成果调研.md:513 已明确记载 LM-CXD "让 KV chunk 成为 device-visible I/O unit，把 NAND→DRAM 进度暴露给 serving engine，并用 device DRAM 作 GPU 可访问 buffer"，说明调研本身知情，P10 却仍将其作为自身洞察。

4) 内部矛盾进一步支持该 finding：L564 写 "vs TempoKV：它做时序，P10 做设备语义与压缩"，但"设备语义"恰恰是 LM-CXD 已做的，不是相对 TempoKV 的差异；而路线 2 又是 TempoKV 的 claim/commit。L563 声称 P10 做"通用接口"，但路线 1–2 并未给出任何超出 LM-CXD/TempoKV 的接口设计。

5) 基线与目标：L571 基线仅列 NVMe SSD、DRAM、stock CXL-SSD，确实排除了 LM-CXD 与 TempoKV；L576 "相对 stock CXL-SSD 提升 2–3×" 的上界 3× 低于 LM-CXD 同基线下的 4.03×。补充证据：TempoKV 摘要报告 p95 TTFT 相对 unmodified LMCache Device-DAX L1 降低 up to 48.0%，P10 的"尾延迟降低 50%"也不构成明显领先（基线不同，但数值不具区分度）。

对评审意见的唯一修正：P10 并非完全无视这两个系统——L563–564 已有 vs LM-CXD / vs TempoKV 的差异化条目。因此修法不应"删除路线 1–2"，而应把它们改写为"复用 LM-CXD/TempoKV 的基础机制"，把创新收敛到多租户 QoS + 设备内压缩，并补上两个基线。这是修法层面的调整，不改变 finding 成立。综合判定 confirmed，严重度 high 合理。
- **修正**：**【核心洞察】（替换 L551）**

CXL 的价值不在"更快的 SSD"，而在**设备可参与语义决策**。但这一判断已由 LM-CXD 用"设备可见 chunk + NAND→DRAM 进度暴露 + 设备 DRAM 缓冲"实现，并由 TempoKV 用 claim/commit 实现；P10 不再把这两条机制当作自身创新，而是在其之上补两块空白：**多租户 QoS（带宽/容量配额、尾延迟隔离）**与**设备内 KV 专用压缩**，并给出"何时 CXL-SSD 值得"的判据。

**【技术路线】（替换 L555–L559）**

1. **复用设备可见 chunk 接口**：采用 LM-CXD 的一等 I/O 单元、NAND→DRAM 进度与 resident 状态暴露，作为 P10 的基础层而非创新点。
2. **复用 claim/commit 协议**：采用 TempoKV 的元数据认领、到期提交与受保护容量语义；P10 仅新增跨租户的受保护容量仲裁。
3. **布局感知压缩**：channel-major/bit-plane、KV 专用变换；压缩在设备内完成，并与 QoS 联合调度（差异化核心）。
4. **多租户 QoS**：带宽/容量配额、租户间隔离、尾延迟保障；给出过载下的隔离性指标（差异化核心）。
5. **仿真/原型**：gem5+CXL 模型 + FPGA/真实 CXL 设备。

**【创新点】（替换 L563–L565）**

- vs LM-CXD：复用其设备可见 chunk 机制；P10 的增量是**多租户 QoS + 设备内压缩 + 端到端 KV 引擎**，不是设备接口本身；
- vs TempoKV：复用其 claim/commit 时序语义；P10 的增量是**跨租户受保护容量仲裁与压缩感知的 commit 估计**；
- vs TRACE：它做压缩原语，P10 做**压缩与 QoS 的联合调度**。

**【评测设计·基线】（替换 L571）**

- 基线：NVMe SSD、DRAM、stock CXL-SSD、**LM-CXD**、**TempoKV**（复现或按其公开配置对齐）。

**【预期结果】（替换 L576–L578）**

- TTFT 相对 stock CXL-SSD：在同配置（layerwise prefetch）下不低于 LM-CXD 的 **4.03×**；若 W1/W4/W5 负载导致绝对值不同，须给出 LM-CXD 在同一负载下的复现值作为对照，并解释差异来源；
- 多租户 SLO：租户过载时 p99 TTFT 降低 **≥50%**，租户间有效带宽偏差 **≤10%**（LM-CXD/TempoKV 未覆盖的指标）；
- 压缩带来有效带宽 **≥1.5×**，并给出与 TRACE 的对比；
- 给出"何时 CXL-SSD 值得"的判据。

## 9. [partially/high] 04-研究方案提案.md — P5 · 问题与证据/核心洞察/基线（L266、L271、L291）
- 说法：P5 的核心是 fetch 与 recompute 并发对冲、先完成者胜出，并称已有工作只把问题表述为“算还是读”的联合调度、缺少尾延迟对冲。
- 问题：Cake 已经实现计算与 I/O 并行、双向调度，并在非前缀请求上自适应；P5 的核心机制是其换名，且基线未包含 Cake。P5 声称的新增部分只有 SLO/p99 对冲预算与取消语义。
- 证据：Cake（arXiv:2410.03065）：“optimally utilizes both computational and I/O resources in parallel... bidirectional scheduling strategy that dynamically balances KV cache computation and loading... 2.6x reduction in TTFT compared to compute-only and I/O-only methods”。
- 复核理由：核对 arXiv:2410.03065 摘要（raw/web/arxiv_raw.json 第 49252 行起）后，评审者的事实前提部分成立，但核心判断（"P5 的核心机制是其换名"）不成立。

成立的部分：
1) 摘要确称 Cake "optimally utilizes both computational and I/O resources in parallel"，采用 "bidirectional scheduling strategy that dynamically balances KV cache computation and loading"，并有 "adaptive scheduling mechanism that seamlessly integrates with non-prefix caching requests"；收益表述为 "on average 2.6x reduction in TTFT compared to compute-only and I/O-only methods"。
2) P5 的基线（L291）确实只有"静态分层、纯 recompute、纯 fetch、Mooncake 风格路由"，没有 Cake；创新点（L283–L285）也只对比 Mooncake/Dynamo 与传统 hedged requests，未对比最接近的 Cake。这是真实的评测设计缺口，应补。

不成立/过强的部分：
1) Cake 的机制是"切分并行"：把同一请求的 KV 分成"加载一部分、计算一部分"，由双向调度动态平衡，目的是同时占满 I/O 与算力、避免资源闲置，不复制完整工作、不取消失败路径，指标是平均 TTFT。P5 的机制是"冗余竞速"：L260 明说"两个可对冲的副本"，L271 "同时发起，先完成者胜出"，L276 "先完成者取消另一个"。前者是 min over split ratio of max(load, compute)，后者是 min(load-all, compute-all) 且失败方工作被丢弃，资源模型与代价结构不同，不能称为换名。
2) 评审自身说"P5 声称的新增部分只有 SLO/p99 对冲预算与取消语义"，这恰好承认取消语义不在 Cake 中，与其"换名"结论自相矛盾。
3) "缺少尾延迟对冲"在摘要层面可辩护：摘要只给平均 TTFT，全文未出现 p99/SLO/hedging/cancellation。因此 P5 以尾延迟与 SLO 违约界为增量是成立的；但 L266 用"算还是读"描述 Cake 不准确——Cake 是"两者同时做"，不是"二选一"。

结论：基线遗漏与 L266 的措辞不精确成立，属 medium；"P5 是 Cake 换名、应降级为工程扩展"不成立。不需要降低 P5 在优先级表中的新颖性评级，只需显式补 Cake 基线并写清增量边界。
- **修正**：按原风格，做以下最小替换：

**L266 替换为：**
- Cake 已在单请求内把 KV 加载与计算切分并行，用双向调度动态平衡两者，并自适应非前缀请求 [arXiv:2410.03065]；但其目标是最小化平均 TTFT、提高资源利用率，不复制工作、不引入取消，也未对存储/网络尾延迟下的 SLO 违约建模。

**L271 末尾追加一句：**
需要与 Cake 的"切分并行"区分：Cake 把同一请求的 KV 分成"加载一部分、计算一部分"，同时占满 I/O 与算力，不产生重复工作；P5 让两条完整路径互为副本，用额外算力/带宽换取尾延迟下降，因此必须配套对冲预算与取消机制。

**创新点（L283–L285）新增一条：**
- vs Cake：Cake 在单请求内切分 KV 加载与计算，优化平均 TTFT；P5 并发两条完整路径，压低 p99 与 SLO 违约率，两者的资源模型与代价结构不同。

**L291 替换为：**
- 基线：静态分层、纯 recompute、纯 fetch、Cake 式双向调度（按最优比例切分加载/计算）、Mooncake 风格路由。

**优先级表（L20）保持不变**：P5 仍为"中高"新颖性；但在提案中须显式承认 Cake 已覆盖"计算与 I/O 并行"，P5 的增量限定为冗余竞速、p99/SLO 违约预算与取消语义，而非"首次让 fetch 与 recompute 并发"。

## 10. [confirmed/high] 04-研究方案提案.md — P4 · 问题与证据/创新点/预期结果（L210、L227、L240）
- 说法：P4 称非前缀修复“可以恢复到 98%–99.8%，但成本与触发条件缺少系统研究”，并提出可验证契约 + 误差界。
- 问题：SAFE-KV 已明确提出 causal-state contract，给出 risk-guided K2 selection（触发条件）和 operating rule（成本结论：忠实修复会退化为 full prefill）。P4 的问题陈述与所引论文直接矛盾。
- 证据：SAFE-KV（arXiv:2610.15186）：“SAFE-KV thus establishes the causal-state contract for non-prefix reuse and a validated repair mechanism that meets it”；“Faithful repair re-encodes most of the context, so... SAFE-KV's operating rule serves every workload by full prefill”；“risk-guided K2 selection”。
- 复核理由：我按要求尝试反驳，但读原始材料后该意见成立。

核对过程：
1. 打开 d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md L202–L242。P4 的问题陈述 L210 原文为“修复可以恢复到 98%–99.8%，但成本与触发条件缺少系统研究”；该句紧接 L209 的 [arXiv:2610.15186]，且 98/99.8 这组数字正是 SAFE-KV 的结果，因此“缺少系统研究”指向的就是 SAFE-KV。
2. 在 d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json 中检索 id=2610.15186v1，摘要逐字包含：
   - “SAFE-KV thus establishes the causal-state contract for non-prefix reuse and a validated repair mechanism that meets it”；
   - “SAFE-KV with risk-guided K2 selection restores 99.8%/98.4% ... and 100.0%/98.4%”；
   - “Faithful repair re-encodes most of the context, so in a single-request L40S study SAFE-KV's operating rule serves every workload by full prefill.”
   评审者三条引文均准确，未误读、未混淆工作。
3. 因此“触发条件缺少研究”与 SAFE-KV 明确给出的 risk-guided K2 selection 冲突；“成本缺少研究”与 SAFE-KV 明确给出的 operating rule（忠实修复退化为 full prefill）冲突。这不是措辞之争，而是 P4 把已被该论文回答的问题重新当成空白，属于事实性/定位性错误，high 合理。
4. 我也尝试了两种反驳，均不成立：(a) 辩称“缺少系统研究”指整个领域而非 SAFE-KV——但同一条 bullet 直接复述 SAFE-KV 的 98–99.8% 数字，无法切割；(b) 辩称“触发条件”指存储层触发而非修复内部选择——即便这一半可辩护，成本那一半仍被摘要末句直接否定，finding 依旧成立。
5. 其他引用无混淆：2605.24022 是 CacheTune（跨 chunk 全局注意力），2609.31415 是 KV reuse 评测高估，均与 P4 用法相符。

需要修正评审建议的一处过度表述：SAFE-KV 的成本结论限定于“single-request L40S study”，评审建议改法写成“已证明忠实修复≈full prefill”时丢掉了这一范围限定，容易被读成普适证明。另 P4 的“98%–99.8%”也与摘要的 98.4%–100.0% 略有出入（漏了 actual suffix forwarding 的 100.0%）。这些是细化，不改变 confirmed 的结论；且 P4 以误差界换回部分复用的研究方向本身仍成立，修法是重新定位 gap，而非删除 P4。
- **修正**：文件：d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md

【L210 整行替换】
- 修复可以恢复到 98.4%–100%（SAFE-KV 的 risk-guided K2 selection；[arXiv:2610.15186]），但其 operating rule 在单请求 L40S 研究中退化为 full prefill——忠实修复需重编码大部分上下文。真正的空白因此不是“能否修复”，而是：在给定误差界 ε 下，如何以可验证的触发条件换回部分复用；

【L227 整行替换】
- vs SAFE-KV：它建立了 causal-state 行为契约并给出 risk-guided K2 修复，但其 operating rule 退化为 full prefill；P4 以**可计算误差界**把“是否修复、修复多少”变成可验证的存储层契约，并补充**存储元数据 + 预算调度**；

【L240 整行替换】
- 在保真度 ≥95% 下，重算量比 SAFE-KV 的 operating rule（即 full prefill）低 **30–50%**；

【可选，同步 L204 一句话以消除残余歧义】
**一句话**：在 SAFE-KV 已给出 causal-state 契约、但其忠实修复在单请求设定下退化为 full prefill 的前提下，为“文档块出现在任意位置”的复用提供带可计算误差界的部分复用与修复机制，把“能不能复用、复用多少”从经验判断变成可验证的契约。

## 11. [confirmed/high] 04-研究方案提案.md — P1 · 问题与证据（L38）
- 说法：P1 称 KVShareArena 已出现跨上下文/跨 checkpoint 复用，“但缺乏统一的成本与正确性口径”。
- 问题：KVShareArena 本身就是统一口径的 benchmark：四类评测视角（答案质量、prefill 计算、KV 内存、延迟）、11 种方法、统一接口和 leaderboard。该句是事实错误，会误导读者认为该方向没有统一评测。
- 证据：KVShareArena（arXiv:2609.10266）：“a benchmark and open evaluation framework for comparing them under the same conditions... four evaluation perspectives: answer quality, prefill computation, KV-cache memory, and latency... a common interface... and an interactive leaderboard”。
- 复核理由：一、原始证据核对。`d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json` 中 id=2609.10266v2 的摘要写明："We introduce KVShareArena, a benchmark and open evaluation framework for comparing them under the same conditions"，四类评测视角为 "answer quality, prefill computation, KV-cache memory, and latency"，另有 11 种方法、"a common interface" 与 "an interactive leaderboard"。评审者引用的文字与原文一致，没有误读或混淆工作。

二、被质疑句确实与摘要冲突。`d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md` L38 写"跨上下文/跨 checkpoint 复用已经出现（KVShareArena），但缺乏统一的成本与正确性口径"。摘要中"成本"对应 prefill computation、KV-cache memory、latency，"正确性"对应 answer quality，KVShareArena 恰恰把这四项统一到同一条件、同一接口与 leaderboard 下。摘要里"each paper uses its own tasks, models, and cost measures"描述的是 KVShareArena 之前的状况，紧接着就说该文填补了这个空白；L38 丢掉了这个时态限定，读起来像该方向至今没有统一口径，属于对引用文献的事实性误述。

三、报告内部自相矛盾，进一步佐证该句有误。同文件 L57 已写"vs KVShareArena：它做评测，P1 做机制与接口"；`d:/xiaojun/work/test/StoreAI/research/02-科研成果调研.md` L992 也正确概括为"它提供跨上下文、跨 checkpoint 的基准与开放评测，并指出各方法自定任务、模型与成本口径，无法横比"。可见作者本意是"此前缺乏、KVShareArena 已统一"，但 L38 的表述把"缺乏"留在了现在时，且主语落在被引用的工作上。

四、评审的核心成立，判 confirmed，严重度 high 合理（属于可定位的事实错误，会误导读者并削弱 P1 的新颖性论证）。但其建议修法有两处不严谨，需要修正：(1) "未把模型/tokenizer/adapter 版本与失效语义下沉为存储对象"中，tokenizer 与 adapter 在摘要中完全未出现，属于超出摘要的否定断言；可验证的区分只是"benchmark/evaluation framework 而非存储层契约"。(2) "把 KVShareArena 列为 P1 的评测基线"是类别错误：`raw/proposal-eval-framework.md` 的 B1–B6 是可运行的推理/存储系统基线，KVShareArena 是评测协议与数据集，应作为 M10/M11 的评测来源，而不是 B 类基线。因此给出可直接替换的 L38 文本，并配一条评测设计修改。
- **修正**：将 `d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md` L38 整句替换为：

"- 跨上下文/跨 checkpoint 复用已有系统研究：KVShareArena [arXiv:2609.10266] 已将 11 种修复/压缩方法置于同一评测条件下，覆盖 33 组模型-数据集设置，并从答案质量、prefill 计算、KV 内存与延迟四个视角给出统一口径；但统一的是评测，不是存储接口——它不定义版本化 KV 对象、失效传播与可被引擎调用的复用契约。"

配套修改（P1「评测设计」，L59–64）：不要把 KVShareArena 写进 B1–B6 基线表（B 类是系统基线，KVShareArena 是 benchmark）。改为在指标/方法处加一句：

"- 复用质量评测采用 KVShareArena 的四视角设置与跨 checkpoint 配对；P1 在其之上补充 M11 复用保真度、M12 误差界违反率与删除传播延迟，作为存储层契约的增量指标。"

（不建议照搬"未把模型/tokenizer/adapter 版本下沉为存储对象"：tokenizer、adapter 未见于该文摘要，超出可核实的证据范围；用"评测框架 vs 存储契约"的区分即可，且与同文件 L57 的定位一致。）

## 12. [partially/medium] 04-研究方案提案.md — P1 · 核心洞察/技术路线/预期结果（L43、L48、L68）
- 说法：P1 的 can_reuse(query_ctx, epsilon) 复用契约与“错误复用率从不可观测降到 <0.1%”被视为新能力。
- 问题：vCache 已提供 user-defined error rate guarantees；FinCacheServe 已用 document/evidence/tool/model/decoding 版本守卫答案复用并报告零 stale；KVShareArena 已在测复用质量。P1 的新颖性主要在“下沉到 KV 存储层”，不是契约概念本身，“不可观测”也不成立。
- 证据：vCache（arXiv:2502.03771）：“the first verified semantic cache with user-defined error rate guarantees”；FinCacheServe（arXiv:2607.26076）：“guarded by document versions, evidence fingerprints, tool fingerprints, model identity, and decoding configuration... zero observed dependency-stale outputs”；KVShareArena（arXiv:2609.10266）。
- 复核理由：核对原文与三条摘要后，评审意见部分成立，但其核心指控误读了 P1 的写法。

1) 评审者引用的三句摘要均准确：
- vCache（2502.03771）摘要确为 "the first verified semantic cache with user-defined error rate guarantees"，但其保证的是**响应级语义缓存**的等价性误判率（在线学 per-prompt 阈值），不是 KV 块在模型/tokenizer/量化/位置漂移下的复用误差。
- FinCacheServe（2607.26076）确实是 "guarded by document versions, evidence fingerprints, tool fingerprints, model identity, and decoding configuration... zero observed dependency-stale outputs"，但它复用和守卫的是**答案对象**（RAG over mutable enterprise docs），不是 KV 对象。
- KVShareArena（2609.10266）确实在测复用质量（answer quality/prefill/memory/latency），但 `04` 的 L38 与 L57 已经明确写了它，并把它定位为"评测"，所以这一条不构成新缺陷。

2) 评审者最重要的判断"P1 的新颖性主要在下沉到 KV 存储层，而不是契约概念本身"——这恰恰是 `04-研究方案提案.md` L56 已经写的内容："vs SAFE-KV/KVBoost：它们在应用层做修复，P1 把契约下沉到存储层，任何引擎都能用"；L57 也把 KVShareArena 定位为评测。原文并未宣称"首次提出契约"这一概念，L43/L48 是设计陈述与 API 定义，不是"首创"声明。因此"P1 把契约概念本身当新能力"这一核心指控不成立。

3) 但有两处确实成立，且属 medium：
- L68 "错误复用率从不可观测降到 <0.1%" 过于绝对。复用保真度在研究中已被测量（SAFE-KV 的 47.2%/37.8%、tolerable set、KVShareArena 的 answer quality），vCache 更已在响应层给出错误率保证；准确说法应是"生产部署中缺乏统一的可观测口径"，而不是"不可观测"。
- P1 的相关工作只对比了 LMCache/Mooncake、SAFE-KV/KVBoost、KVShareArena，**完全漏掉 vCache 与 FinCacheServe**（`04` 与 `05` 均未引用；FinCacheServe 连 `05a-完整文献表.md` 都没有）。这两篇正是"误差有界复用"和"版本守卫"最接近的先验工作，应在 P1 的创新点中对比，否则会被审稿人认为未读相关文献。

综上：新颖性框架本身无需改（已经写明是"下沉到存储层"），但 L68 措辞需降级，且必须补 vCache/FinCacheServe 的对比。判 partially，给出最小修法。
- **修正**：【替换 L68 那一行】
- 在同等硬件下，**生产中缺乏统一的错误复用可观测口径**；在注入模型更新/文档更新/用户删除事件后，按 M11/M12 度量的错误复用率降到 **<0.1%**；

【在 L57 之后新增两条创新点】
- vs vCache [arXiv:2502.03771]：它在响应级语义缓存上用在线学习阈值给出用户可定义错误率保证；P1 把"误差有界复用"下沉到 KV 对象层，覆盖模型、tokenizer、量化、位置等版本维度，而不只是判定提示是否语义等价；
- vs FinCacheServe [arXiv:2607.26076]：它用文档/证据/工具/模型/解码指纹守卫答案复用，并在其负载上报告零 stale；P1 把同类版本守卫推广到 KV 块，并提供跨引擎接口。

【可选：把 L48 句首改为】
2. **复用契约 API**（思想借鉴 vCache 的误差保证与 FinCacheServe 的版本守卫，但作用于 KV 块）：`can_reuse(query_ctx, epsilon) -> {exact | bounded(eps) | must_recompute}`；返回可复用的块列表、预期误差、读取代价估计。

【可选：在 L57 后补一句，明确不重叠】
- 与 KVShareArena 的关系是互补：它提供跨上下文/跨 checkpoint 的评测口径，P1 提供可被其评测的存储层机制与接口。

## 13. [partially/medium] 04-研究方案提案.md — P2 · 基线/预期结果（L123、L128）
- 说法：P2 预期 SSD-backed KV 有效吞吐提升 1.5–2.5×，基线为 B1/B3/B4/B5 与 CPU+io_uring。
- 问题：Tutti 已在同类 GDS/LMCache 基线上报告 2× 可达请求率与 78.3% TTFT 降低；P2 的目标上限与 Tutti 持平，而 Tutti 和 Range 都不在基线中。
- 证据：Tutti（arXiv:2605.03375）：“reduces TTFT by 78.3%... improves the achievable request rate by 2x... serving cost reduced by 27%”；P2 L123 的基线列表没有 Tutti/Range。
- 复核理由：核对结果（原始材料：d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json 中 id=2605.03375v1；同目录 curated-kv-offload-tiered.md 第 48–51 条）：

一、评审者的引文是准确的，没有误读摘要。Tutti 摘要原文为 "compared to the state-of-the-art GDS-enabled, SSD-backed LMCache, Tutti reduces TTFT by 78.3% under strict SLO constraints and improves the achievable request rate by 2x. The serving cost is reduced by 27%."。但评审者漏掉了最关键的前提词——对照对象是 "GDS-enabled, SSD-backed LMCache"，且 2× 是 strict SLO 下的 achievable request rate，不是 token/s/GPU 或 token/s/$。

二、评审者的两处表述不准确，因此不能判 confirmed：
1) 04-研究方案提案.md L128 的目标区间是 1.5–2.5×，上限 2.5× 高于 Tutti 的 2×（中位数恰为 2.0×）。说"目标上限与 Tutti 持平"是夸大，准确说法是"目标中位数与 Tutti 持平"。
2) "Tutti 和 Range 都不在基线中"在字面上成立，但 B4 就是 LMCache——正是 Tutti 的对照对象；真正的缺口不是"没列 LMCache"，而是 raw/proposal-eval-framework.md L75 只写 "B4 LMCache"，没有规定是否启用 GDS、是否 SSD-backed。把 Tutti/Range 直接列为"基线"也有范畴错误：它们是系统/存储引擎，不是 B1–B6 那类可平级替换的推理栈。

三、评审者可能漏读了 04-研究方案提案.md L115：那里已经写明"vs Tutti：Tutti 证明单租户可行，P2 解决多租户 QoS 与错误模型；vs Range：……P2 给出聚合 + 配额的系统机制"。也就是说，评审者建议的"把贡献聚焦到多租户 p99/隔离度"已经是文章的既定定位，不是缺失项。

四、但核心问题成立，所以不能判 refuted：
- L123 未说明 B4 的配置口径，L128 的 1.5–2.5× 因此无法与 Tutti 已发表的 2× 区分开——若 B4 跑默认 CPU-centric LMCache，P2 的增益主要是 Tutti 已证明的 GPU-centric 路径收益；若 B4 跑 GDS-enabled SSD-backed LMCache，则须说明与 Tutti 的增量来自何处。提案没有做这个拆分。
- Range（arXiv:2610.21241v1）摘要给出：6 GiB 恢复的中位 TTFT 在 32× 对象数范围内保持 1.79–1.80 s，而 tuned in-process LMCache 从 2.12 s 升到 3.01 s。这说明"按对象计费"问题已被 Range 系统性地处理；P2 L130"单对象 I/O 开销降低 3–5×（聚合后）"若以 stock LMCache 为参照，会把 Range 的贡献算进自己。
- 附带发现：L122 的指标列表只有 M1/M2、M3、M8、M14、M13，没有 M4（有效吞吐），而 L128 恰恰用"有效吞吐"作为首要预期结果——该指标在评测设计里没有对应项（raw/proposal-eval-framework.md L35 定义 M4 为 token/s/GPU、token/s/$）。这让 L128 的数字缺少可核对的指标口径。

结论：问题的主体（单租户吞吐目标未相对 Tutti 锚定、B4 口径未定义、对象聚合贡献可能与 Range 重叠）成立；但"上限持平""Tutti/Range 不在基线"两处表述不准确，且 L115 已部分回应了"应聚焦多租户"的建议。故判 partially，severity 维持 medium 偏高但可接受（更接近 medium 的表述问题，而非事实错误）。
- **修正**：最小修法：不改动 L115 的定位，只把评测设计与预期结果的口径补齐。

L123 替换为：
- 基线：B1/B3/B5；**B4 明确配置为 GDS-enabled、SSD-backed LMCache（即 Tutti 的对照口径）**；另将 Tutti（strict SLO 下 2× 可达请求率、TTFT −78.3%）与 Range（6 GiB 恢复中位 TTFT 1.79–1.80 s，对照 tuned LMCache 2.12→3.01 s）的报告值列为**单租户参照点**，不与 B1–B5 平级；对照"CPU 发起 + io_uring"路径。

L128 替换为：
- 单租户：SSD-backed KV 的有效吞吐（M4）相对 GDS-enabled SSD-backed LMCache 提升 **1.5–2.5×**；该区间中位数与 Tutti 已报告的 2× 同量级，因此本方案不把单租户吞吐作为主贡献，而用消融实验分离"GPU-centric 路径"与"对象聚合"各自的增量，并明确标注相对 Tutti 的净增量；

L129 替换为：
- 多租户：p99 降低 **40–60%**，以 M14 隔离度为主指标，相对同配置的单租户路径（含 Tutti 口径）报告干扰导致的退化；

同时把 L122 指标列表补为：
- 指标：M1/M2 p99、M3 goodput、**M4 有效吞吐**、M8 元数据开销、M14 隔离度、M13 错误恢复。

## 14. [refuted/medium] 04-研究方案提案.md — P2 · 问题与证据/预期结果（L97、L130）
- 说法：P2 预期“单对象 I/O 开销降低 3–5×（聚合后）”。
- 问题：P2 自己引用的 Range 测量显示，对象数从 6,144 降到 192（32×）只把 6 GiB 恢复时间从 3.0 s 降到 2.1 s（1.43×）；3–5× 的端到端收益与该数据矛盾。
- 证据：Range（arXiv:2610.21241）：“restoring the same 6 GiB of KV takes 2.1 s as 192 objects but 3.0 s as 6,144 objects”；P2 L97 引用同一数据。
- 复核理由：评审者对 Range 摘要的引用本身准确：d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json 中 arXiv:2610.21241 摘要原文为 "restoring the same 6 GiB of KV takes 2.1 s as 192 objects but 3.0 s as 6,144 objects"，3.0/2.1≈1.43×，与评审者的算术一致；P2 L97 的转述也无误。但评审意见的落点（"3–5× 的端到端收益与该数据矛盾"）建立在对 P2 原文的误读上，因此不成立，理由有四：

1) P2 并没有把 3–5× 说成端到端收益。04-研究方案提案.md L126–130 的"预期结果"是三条并列指标：L128 "SSD-backed KV 的有效吞吐提升 1.5–2.5×"、L129 "多租户下 p99 降低 40–60%"、L130 "单对象 I/O 开销降低 3–5×（聚合后）"。端到端吞吐由 L128 单独承担，L130 是分项开销目标。评审者把 L130 的"单对象 I/O 开销"改写成"端到端收益"，再拿端到端数据去反驳，属于混淆了对象。

2) 在原文的自然读法下，3–5× 与 Range 数据不矛盾，反而是保守目标。L130 的括号"（聚合后）"表明它指的是"按对象计费的那部分开销"（摘要明确列举 lookup、allocation、I/O submission、GPU delivery、store、index 逐层按对象收费）。Range 的核心结论正是这部分工作随对象数线性缩放；P2 的技术路线第 1 条就是"一个 doorbell 提交 N 个 KV 块"。对象数从 6,144 降到 192 是 32×，把逐对象总开销压到 3–5× 远在 32× 的缩放能力之内。用测量值反推也可自洽：3.0 s 中逐对象分量为 3.0−2.1=0.9 s（占恢复时间约 30%），降低 3–5× 即省 0.6–0.72 s（约 21–24%），完全落在实测 30% 的包络内，没有任何矛盾。

3) 评审者给的修法基本是空操作。"单对象 I/O 开销降低 3–5×"与其建议的"每对象元数据开销降低 3–5×"在语义上几乎同义；且若按字面理解为"单个对象的延迟/开销"，聚合会让每个对象变大、单对象开销不降反升，这个替换说法本身也站不住。真正可做的只是把它与 M8 口径（raw/proposal-eval-framework.md："M8 元数据开销 = metadata ops/s、元数据字节/KV 字节"）绑定，属于可选澄清，不是纠错。

4) 评审者引用的"端到端上界"只对 L128 有意义，而非 L130。Range 摘要给出：Range 自身在 32× 对象数范围内 median TTFT 稳定在 1.79–1.80 s，距 prefix 常驻 GPU 仅 70 ms；对比调优后的 in-process LMCache 2.12→3.01 s 约为 1.67×，对比最快 stock coarse 2.24 s 约 1.24×，相对 3.0 s 的理论上界约 1.74×。这说明"端到端 3–5×"确实不可能——但 P2 从未作此声称；L128 的 1.5–2.5× 目标虽偏乐观，也不是本次被质疑的那条。

综上：评审者的数据引用正确，但把 L130 的分项指标误读为端到端收益，并据此要求修改——目标本身（按对象计的开销降低 3–5×）有 Range 的对象数缩放模型支撑且偏保守，故判 refuted。唯一残留的是措辞不够精确（"单对象"易被读成单对象延迟），这属于 low 级澄清，不构成 medium 级的事实矛盾。
- **修正**：无需修改。原句是"按对象计的分项开销目标"，不是端到端吞吐，与 L97 所引 Range 数据（3.0 s→2.1 s）并不矛盾；3–5× 相对 32× 的对象数缩减是保守目标。

若想预先消除被误读的空间，可在不改结论的前提下做一处可选澄清（非必须）：
- 单对象 I/O 开销降低 **3–5×**（聚合后；指每对象在查找/分配/提交/投递/写回/索引上的合计开销，对应 M8，非端到端吞吐）。

端到端目标仍由上一行"有效吞吐提升 1.5–2.5×"承担。若要让它与 Range 的实测对齐，可把该行补一句限定（可选）：
- SSD-backed KV 的有效吞吐提升 **1.5–2.5×**（其中恢复路径端到端上界约 1.7×：Range 实测 1.79–1.80 s 对 3.0 s；其余增益来自多租户 QoS 与尾延迟隔离）。

## 15. [partially/medium] 04-研究方案提案.md — P3 · 评测设计/预期结果/时间线（L177–180、L184、L194–196）
- 说法：P3 计划 15 个月内用 FEMU + 真实 NVMe SMART 验证“SSD 寿命延长 2–4×”，并采集 30–90 天长期 trace。
- 问题：SSD 寿命是年级时间尺度，15 个月内无法直接观测 2–4× 寿命；FEMU 只能模拟，SMART 短期观测不能验证寿命；30–90 天 trace 采集还会压缩本已紧张的时间线。该目标按当前评测设计不可测。
- 证据：P3 时间线 L194–196（M1–M3 模型+仿真、M9–M12 真实 SSD 评测、M13–M15 论文）；预期 L184；风险 L192 自认“长期 trace 获取困难”。
- 复核理由：【定位核对：评审者的行号与引文全部准确】04-研究方案提案.md L177–180 确实写「构造 30–90 天长期 trace」「M7 WA/TBW」「S3 FEMU/SimpleSSD + S1 真实 NVMe（SMART 采集）」；L184 写「SSD 寿命延长 2–4×」；L194–196 的 15 个月时间线中真实 SSD 评测只有 M9–M12 四个月；L192 确实自认「长期 trace 获取困难」。没有误引、没有混淆其他方案。

【但「按当前评测设计不可测」不成立——报告自带可测口径】1) 共享框架 raw/proposal-eval-framework.md L43 对 M7 的定义是「实际 NAND 写入/主机写入；TBW 消耗/年」，采集方式正是「FEMU 或设备 SMART」；2) P3 自身 L163 已给出 `TBW(t)=Σwrites×WA(utilization,GC)` 的寿命模型，技术路线第 5 条 L167 还要求「暴露 TBW 消耗/年、WA、剩余寿命」；3) raw/analysis-quant.md L504 已有 DWPD=1、30 TB、5 年约 55 PB/盘 的折算模型。三者合起来足以把「寿命延长 2–4×」变成可计算的派生量（额定 TBW ÷ 年化写入量），无需等到磨损终点。4) 该量在本领域就是标准报告口径：Gandalf（arXiv:2610.30791）摘要直接声称「extends the SSD lifetime by 7.3X on average」，靠的是仿真与写量对比而非实测寿命终点；arXiv:2609.07175 用解析模型报 HBF 从约 1 年延到 6 年以上。若判 2–4× 不可测，等于同时否定这两篇的头条结果。

【仍然成立的部分】a) L184 把派生量当成直接结果写出，未给推导口径、假设（DWPD/容量/OP）与不确定性，读者无法复现 2–4×，这是真实缺陷；b) L180 只写「SMART 采集」，未说明 SMART 只能标定 WA 与磨损速率、不能验证寿命终点，评审这一点正确；c) 「30–90 天 trace」在评测设计与 15 个月时间线中都没有任何排期，L192 仅把它列为风险，确实是与 15 个月时间线冲突的规划缺口。

【评审者越界之处】「把 30–90 天 trace 作为 M1–M3 的输入」是评审者自行推断，原文从未这样写；且 M1–M3 的模型+仿真完全可用公开 trace（W1/W3/W5 对应 ShareGPT/LMSYS、Mooncake、BurstGPT、Azure，见 proposal-eval-framework.md L11/L13/L15）。因此「trace 采集压缩时间线」应改成「trace 采集未排期」，严重度仍是 medium，不是 high。

结论：实质问题成立（寿命目标缺少可复现的派生口径、SMART 定位不清、trace 未排期），但「不可测」与「M1–M3 输入」两处定性过强，判 partially；最小修法是把寿命明确写成「由实测 WA/TBW 外推的派生指标 + 加速写入斜率校验 + 区间」，并把 trace 采集并行化而非前置阻塞。
- **修正**：### 评测设计

- 负载：W1/W3/W5；M1–M8 用公开 trace（ShareGPT/Mooncake/BurstGPT/Azure）驱动仿真，同时从 M1 起并行采集 30–90 天生产 trace，仅用于长程复用距离与寿命外推的校准，不阻塞模型与原型阶段。
- 指标：主指标为 M7 的**年化主机写入量**与**WA 校正后的 TBW 消耗/年**；辅以 M5 命中率、M1 TTFT、M9 \$/M-token、M16 能耗。
- 基线：LRU、Gandalf 类门控、SARIA 类选择性持久化、无门控。
- 方法：S3 FEMU/SimpleSSD 模拟 NAND 写入与 GC，得到 WA(利用率) 曲线；S1 真实 NVMe 用 SMART（Data Units Written、Percentage Used、Media Wearout）做 4–8 周满带宽写入，标定实测 WA 与磨损速率；再按 `寿命 = 额定 TBW / 年化写入量` 外推，并在单一型号上做加速写入以校验外推斜率。所有寿命数字标注为**外推值**，给出型号参数（DWPD、容量、OP）与 95% 区间。

### 预期结果（目标）

- 在命中率损失 <5% 的前提下，年化主机写入量降低 **3–5×**，WA 校正后的 TBW 消耗同步降低；
- 按额定 TBW 外推，等效 SSD 寿命延长 **2–4×**（外推值；附单一型号加速写入的斜率校验与参数敏感性区间，不以实测磨损终点为依据）；
- 给出可复用的 TBW 预算模型与不确定性量化（论文贡献）。

### 风险

- 外推依赖 SSD 额定 TBW 与 WA–利用率曲线；不同型号需重新标定，结论以区间而非点值报告；
- 加速老化只能在少量型号上做，跨型号结论属模型外推；
- 长期 trace 获取困难（可与云厂商合作）；若无法获取，退回公开 trace + 合成长程 trace，并在论文中说明其对复用距离分布的影响。

### 时间线（15 个月）

M1–M3 寿命模型 + 仿真，同时启动 trace 采集；M4–M8 门控原型 + FEMU；M9–M12 真实 SSD 标定（4–8 周加速写入 + SMART）与单型号加速老化校验；M13–M15 论文。

## 16. [partially/medium] 04-研究方案提案.md — P4 · 基线/预期结果（L235、L240–242）
- 说法：P4 预期在保真度 ≥95% 下重算量比 SAFE-KV 低 30–50%，TTFT 相对 full prefill 降低 2–4×。
- 问题：SAFE-KV 的 operating rule 已是 full prefill，“比 SAFE-KV 低 30–50% 重算”等于要在不全量重算下维持 95% 保真度，这正是 SAFE-KV 认为不可行的点；CacheTune 已报告 3.72–4.86× TTFT 且质量接近 full recompute，P4 的 2–4× 低于该 SOTA 且未列 CacheTune 基线。
- 证据：SAFE-KV（2610.15186）：“Faithful repair re-encodes most of the context, so... SAFE-KV's operating rule serves every workload by full prefill”；CacheTune（2605.24022）：“3.72x-4.86x TTFT speedup... maintaining generation quality close to full recompute”。
- 复核理由：我逐条核对了原始材料，结论是：评审者的**可执行建议成立**，但其**核心论证有一处误读**，且"SOTA 对比"不够严谨，因此判 partially。

一、成立的部分（有原文支撑）
1. SAFE-KV 的 operating rule 确为 full prefill。arXiv:2610.15186v1 摘要原文："Faithful repair re-encodes most of the context, so in a single-request L40S study SAFE-KV's operating rule serves every workload by full prefill." 因此 P4 在 L240 写的"重算量比 SAFE-KV 低 30–50%"，若 SAFE-KV=100%，实际等价于"重算 50–70% 上下文"；把它写成"比 SAFE-KV 低"会让读者误以为对标的是一个部分复用方法，而实际对标的是 full prefill。这是真实的表述缺陷（medium）。
2. CacheTune 确为 arXiv:2605.24022v2，摘要原文："CacheTune achieves 3.72x-4.86x TTFT speedup and 3.93x-6.21x higher throughput while maintaining generation quality close to full recompute." P4 的 L235 基线只列 CacheBlend、SAFE-KV、KVBoost、full prefill，未列 CacheTune；而 P4 自己在 L208 又把 2605.24022 当作"非前缀复用破坏全局注意力"的证据引用。把一篇系统论文当作问题证据却不列为基线，是内部不一致，这一条成立。另外全局评测框架 `raw/proposal-eval-framework.md` 的 B1–B6 也没有 CacheTune，缺口是系统性的。

二、评审者误读/过强的部分
1. **"这正是 SAFE-KV 认为不可行的点"是过度解读。** SAFE-KV 那句话的主语是它自己的 suffix-repair 机制（"Faithful repair re-encodes most of the context"），结论是"其 operating rule 退化为 full prefill"，并不是"任何非全量重算都无法维持高保真"的一般性不可能结论。P4 的技术路线（L220）恰恰是 boundary suffix re-encode + KVBoost 式 deviation-guided recompute + 误差界，SAFE-KV 并未测试这条路径；CacheTune 本身就是"选择性重算关键 token、质量接近 full recompute"的反例。所以 P4 的目标不是被 SAFE-KV 证伪，而是"基线口径写错"。
2. **"P4 的 2–4× 低于该 SOTA"不严密。** 2–4× 与 3.72–4.86× 在 3.72–4× 区间重叠，只能说上限 4× 低于对方上限 4.86×，不能说整体低于。更重要的是：CacheTune 摘要没有说明 3.72–4.86× 的参照是什么（full prefill 还是其它基线），其"quality close to full recompute"也没有量化为本报告 M11 定义的"与 full prefill 的逐样本输出一致率"；且其评测是 long-context tasks，P4 是 RAG（HotpotQA/2Wiki/NQ），两者不是干净的同一口径。因此"P4 未超过 SOTA"可以提，但不能直接用摘要数字下结论。

三、因此
缺陷的核心不是"P4 目标不可能"，而是：(a) 用退化为 full prefill 的 SAFE-KV 当相对基线，导致 L240 的表述误导；(b) 引用了 CacheTune 却不把它列入基线，使 L242 的 TTFT 目标缺少真正有意义的参照。评审建议的修法（加 CacheTune、改成绝对重算比例上界、以误差界换复用）方向正确，但理由需改写，去掉"SAFE-KV 判定不可行"的措辞。
- **修正**：将 L235 替换为：

- 基线：CacheBlend、CacheTune [arXiv:2605.24022]、SAFE-KV、KVBoost、full prefill。需注明：SAFE-KV 的 operating rule 在其单请求 L40S 研究中退化为 full prefill，故"相对 SAFE-KV"与"相对 full prefill"是同一口径。

将 L240–242 替换为：

- 在保真度（M11：与 full prefill 的逐样本输出一致率）≥95% 下，把重算 token 占比压到 **50–70%**（即相对 SAFE-KV 的 100% full-prefill 口径减少 30–50% 重算），并给出该比例的可达上界；
- 给出可复现的"误差-成本"曲线，并说明误差界带来的额外重算成本；
- 在 RAG 负载上 TTFT 相对 full prefill 降低 **2–4×**，同时在同硬件、同负载下与 CacheTune 的 3.72–4.86× 做对照；若低于该区间，需说明是负载/设置差异，还是可证明误差界的保守性所致。

（最小修法即可止于上述两处替换；若要一并修正系统性遗漏，建议在 02-科研成果调研.md 第 478/555 行与 03-优劣势总结报告.md 第 89 行补充 SAFE-KV "faithful repair 需重编码大部分上下文、operating rule 退化为 full prefill"这一限制，否则读者会误以为 SAFE-KV 已实现低成本高保真复用。）

## 17. [partially/medium] 04-研究方案提案.md — P5 · 问题与证据/核心洞察（L264、L271）
- 说法：P5 用“远端命中 0.88 s vs 重算 0.31 s”论证需要 fetch/recompute 对冲。
- 问题：该数据说明重算在均值上快约 2.8×；若按此证据，理性策略是直接重算而非对冲，对冲只会额外消耗 fetch 带宽。P5 未证明 recompute 的尾延迟也会超过 SLO，因此对冲的收益条件不成立。
- 证据：P5 L264 引用（arXiv:2610.21500）：“a remote hit took 0.88 s against 0.31 s to recompute the prompt”；P5 未给出 recompute 在 GPU 争用下的尾延迟分布。
- 复核理由：核对结果：评审者的事实引用本身没错，但其推论和修法方向都与原文相反，因此不能判 confirmed。

一、引用属实（评审者这部分成立）
- 原文 L264 的句子确实存在。arXiv:2610.21500（"When the KV Cache Is Slower Than the GPU"，Muhammad Ibrahim，2026-10-15）摘要原句为："Replaying a production request stream on an isolated engine, we find that a remote hit took 0.88 s against 0.31 s to recompute the prompt"。
- "p99 从 3.96 s 涨到 17.3 s" 也属实（"raised the 16k-token p99 from 3.96 s to 17.3 s"）。
- P5 全篇（L262–L304）确实没有给出 fetch 与 recompute 的尾延迟分布对比，也没有写出对冲的收益条件；L271 只到"估计两者的完成时间分布"为止，L275–L276 也只说"当 fetch 的预测尾延迟超过 SLO 风险阈值时"启动 recompute。这条证据确实不足以单独支撑对冲机制的收益，评审者指出的证据缺口是真实的。

二、评审者的推论不成立（这是不能判 confirmed 的关键）
1. "理性策略是直接重算" 与原文结论直接冲突。同一摘要给出的成本模型是："a hit pays off only if the tier delivers more than B* = sR (2.53 GB/s for this model and GPU), and a fixed per-hit engine cost (T0 ~ 0.33 s) means that hits on prompts shorter than about 17k tokens cannot beat recompute at any bandwidth."即 0.88 vs 0.31 恰恰是"短 prompt / 带宽不足"这一侧的条件性观测，不是普遍均值。该文随后把 GET 带宽从 1.7 GB/s 量级提升 6.3× 到 10.76 GB/s（远超 B*=2.53 GB/s），在 98.5% token 走远端时把 p99 从 83.32 s 降到 0.67 s。也就是说，按原文自身的证据，"直接重算"不是理性策略，正确的理性策略是"按 bandwidth×prompt 长度选边"。
2. "均值快约 2.8×" 是把单次 replay 观测当成均值；摘要没有给出该数的统计口径（mean/median 均未声明），把它当作分布均值来论证"均值策略"属于误读。
3. "对冲只会额外消耗 fetch 带宽" 也误置了成本。P5 L271 明确写"浪费一部分算力/带宽"，L277 还专门设了全局对冲预算；对冲消耗的是双份资源，不是只消耗 fetch 带宽。
4. 评审者把收益条件写成"证明 recompute 的尾延迟也会超过 SLO"逻辑上是错的：若 recompute 尾延迟稳定超过 SLO，拿它去对冲只会把 SLO 违约率拖得更差。对冲成立的正确条件是 min(T_fetch, T_recompute) 在 SLO 截止时刻的分位低于单独 T_fetch 的分位，即两者分布的尾部在时间轴上有交叉、且 recompute 的尾部不严格劣于 SLO。

三、但原文还有一处比评审者说的更重的问题，P5 也没写
原文把 p99 恶化归因于 "synchronous loading turned a hit-heavy stream into an unstable queue: p99 83.32 s with the GPUs 7% busy"，并明确说 "(iv) fix three client bugs that caused unbounded stalls"，修法是分片 + 异步加载 + 修 bug，而不是对冲。这意味着"远端命中反而更慢的长尾"（P5 L260）在该文里被当作可被存储层修掉的工程缺陷，不是需要靠 recompute 对冲来兜底的固有性质。P5 只截取了 0.88/0.31 和 p99 4× 恶化两个数，隐去了"该长尾已被原作者用异步加载修到 0.67 s"这一反证，这属于选择性引用（medium），但它支持的是"P5 需要重写动机与条件"，而不是评审者给的"默认重算"。

四、结论
- 评审者的事实核对正确，证据缺口（无尾延迟分布、无对冲收益条件）真实存在 → 不能判 refuted。
- 评审者的因果推论与建议修法（默认重算）被原文成本模型直接反驳 → 不能判 confirmed。
- 判 partially：保留其"补尾部分布 + 给出对冲收益条件"的要求，删去其"默认重算"的结论，并补充原文的 B*=2.53 GB/s 与 ~17k token 交叉点这一更强的约束。

五、最小修法
只需改两处：L264 补上原文的条件化成本模型与其自身修复结果，L271 把"关键是估计分布"升级为可检验的收益条件，并明确"能判定谁更快时直接选，不对冲"。另建议在 L291 评测基线/指标处加一句"报告 recompute 在 GPU 争用下的 p99 与 fetch 的 p99，给出两者交叉点"，以满足评审者的合理要求。无需改动 L275–L279 的技术路线。
- **修正**：【替换 L264】
- 远端命中 0.88 s vs 重算 0.31 s；16k token 的 p99 从 3.96 s 涨到 17.3 s [arXiv:2610.21500]。但该文的成本模型给出了更强的条件：命中只有在远端带宽超过 B\* = sR（该模型/GPU 为 2.53 GB/s）、且 prompt 长于约 17k token 时才划算，更短的 prompt 在任何带宽下都赢不过重算；其 hit-heavy 流上 p99 83.32 s（GPU 仅 7% 忙）主要由同步加载与三个客户端 bug 造成，分片 + 异步加载后降至 0.67 s（98.5% token 走远端）。

【替换 L271】
Fetch 与 recompute 的延迟分布不同、资源不同（网络/SSD vs GPU），因此可以像"hedged requests"一样同时发起，先完成者胜出；代价是同时浪费一部分算力与带宽。对冲的收益条件必须显式给出：在 SLO 截止时刻 t_d，min(T_fetch, T_recompute) 的 p 分位需显著低于单独 T_fetch 的 p 分位，且 recompute 的尾延迟不严格劣于 SLO——若某类请求（如 <17k token，或带宽充足的长 prompt）已能稳定判定谁更快，就应直接选快者，而不是对冲。关键是联合估计两者的完成时间分布及其交叉点，并据此控制对冲预算。

【建议在 L291"评测设计"指标行追加一句（可选，用于回应评审者的合理要求）】
- 指标：M1/M2 p99、M3 goodput、SLO 违约率、额外算力开销；并分别报告 fetch 与 recompute（含 GPU 争用下）的 p50/p99 及其交叉点，作为对冲收益条件的直接证据。

## 18. [partially/medium] 04-研究方案提案.md — P6 · 创新点（L340–342）
- 说法：P6 的创新点是“vs Mem0/Zep/MemGPT 做事务与治理”，并给新颖性“高”。
- 问题：PolyMemDB 已做 polyglot 存储 + provenance + 时间衰减；ChronoMem 已做整库版本/回滚并集成 Google ADK；MOSS 已做可审计的关系型 agent memory；GEM 已定义状态轨迹正确性。P6 的“事务与治理”并非空白，且未在创新点中对比这些工作。
- 证据：PolyMemDB（arXiv:2608.25577）：“polyglot storage architecture... fine-grained data provenance... temporal decay”；ChronoMem（arXiv:2607.27773）：“semantic version-control layer... commits whole-memory snapshots... supports natural-language rollback”；MOSS（arXiv:2607.04391）：“auditable... every step... logged and inspectable”；GEM（arXiv:2605.26252）。
- 复核理由：核对结果：评审的核心方向成立，但证据有夸大，且对 GEM 的指控不成立。

1) 原文事实核实。`d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md` L20 给 P6 的新颖性为"高"；L338–342 的创新点只有三条，确实只对比了 Mem0/Zep/MemGPT、GEM 与传统 DB，没有出现 ChronoMem、PolyMemDB、MOSS。这一点评审说得对。

2) 逐篇核对 arXiv 摘要（`research/raw/web/arxiv_raw.json`）：
- ChronoMem（2607.27773）：摘要明确"semantic version-control layer... integrated into the production-ready, open-source Agent Development Kit by Google""commits whole-memory snapshots at each memory write""supports natural-language rollback"，并自称首个开源的系统+基准。这是与 P6 "版本/回滚"最近的实体系统，而 04 只在 L321 把它当作"存储放大未量化"的证据引用，创新点里完全没有定位。此处评审成立，也是最实质的缺口。
- PolyMemDB（2608.25577）：摘要确有 polyglot（graph/vector/probability/spatial-temporal）+ fine-grained provenance + temporal decay/semiring aggregation。但它是 "In this demonstration" 的 demo 论文，摘要中没有任何事务、ACID、MVCC、删除或并发语义。因此"provenance/时间衰减已被做过"成立，"事务被做过"不成立；把它直接列为 P6 的事务基线也不合理。
- MOSS（2607.04391）：摘要是关系库上的符号化、可复现检索，"every step... logged and inspectable, making MOSS auditable by construction"。这是审计日志，不是事务/多租户治理，摘要也没有 ACID、MVCC、遗忘或并发控制。评审把它当作"事务与治理并非空白"的证据属于过度解读。
- GEM（2605.26252）：摘要确为愿景 + 四算子 + 六条件 + MemState 属性图原型。但 04 在 L320 已引用它，L341 的创新点也已明确"GEM 是愿景，P6 是可运行的系统+基准"，这一区分是站得住的。评审说"未在创新点中对比这些工作"对 GEM 不成立。

3) 结论：真正需要修的是 P6 创新点缺少与 ChronoMem（版本/回滚）、PolyMemDB（provenance/时间衰减）、MOSS（可审计检索）的定位，导致"事务与治理"这一整块表述显得像是空白，与"新颖性 高"的评级不匹配。但"这些工作已经做了事务与治理"不成立：四篇里没有任何一篇提供 ACID/MVCC、精确遗忘或跨 agent 并发控制。故判 partially，而非 confirmed；最小修法是把创新点收缩为"ACID/MVCC + 精确遗忘/删除传播 + 多 agent 并发控制 + 所有权/租户治理"，并补上 ChronoMem 的快照放大对比；PolyMemDB/MOSS 放 related work 而不是事务基线。
- **修正**：（替换 `04-研究方案提案.md` L340–342 的三条创新点）

- vs Mem0/Zep/MemGPT：它们做检索/抽取，P6 做**事务与治理**——ACID 提交、MVCC 快照读、精确遗忘与多 agent 并发控制；
- vs ChronoMem：它把每次写入提交为整库快照做语义回滚，P6 用 append-only WAL + 增量版本实现原子提交，并把整库快照的存储放大变成可量化、可 GC 的问题 [arXiv:2607.27773]；
- vs PolyMemDB / MOSS：前者覆盖 polyglot 存储 + 细粒度 provenance + 时间衰减，后者在关系库上做可审计检索，但都不提供事务原子性、派生数据删除传播与所有权/租户治理；P6 把这些纳入同一事务边界 [arXiv:2608.25577][arXiv:2607.04391]；
- vs GEM：GEM 是愿景（四算子 + 六条件 + MemState 原型），P6 是**可运行的系统 + 基准** [arXiv:2605.26252]；
- vs 传统 DB：事务/版本成熟但无记忆语义与派生删除，P6 把"语义检索"与"事务/版本"放进同一引擎，是新的数据模型。

（同时把 L348 基线一行替换为）

- 基线：Mem0、Zep、ChronoMem（版本/回滚）、文件式记忆、向量库 + 应用层事务；PolyMemDB 作为 provenance/时间衰减的参照实现（demo 论文，不承担事务基线）。

## 19. [partially/medium] 04-研究方案提案.md — P6 · 技术路线/预期结果（L334、L354）
- 说法：P6 预期“精确遗忘达到 100%（含派生数据）”，并用 crypto-shredding 做合规删除。
- 问题：若派生摘要/embedding 以明文存储，删除源数据的密钥不能删除已生成的派生内容；要达 100% 需所有派生数据都用源派生密钥加密，proposal 未给出这个约束，且与“派生摘要/索引/embedding 级联失效”的明文索引设计冲突。
- 证据：P6 L334“crypto-shredding 用于合规删除”；L354“精确遗忘达到 100%（含派生数据）”；Bemula（2610.18052）只评测遗忘请求，不保证派生数据。
- 复核理由：核对结果：评审的核心缺陷成立，但有两处表述不准确，故判 partially，严重度 medium 合理。

一、成立的部分（读了原始材料后仍成立）
1. P6 技术路线 L334 只写了"派生摘要/索引/embedding 的级联失效；crypto-shredding 用于合规删除"，数据模型 L332 与索引 L335 均无 `key_id`/加密字段，安全项 L336 也没有加密或密钥管理；全文 04 除 L334 外没有任何 per-source key 或"派生对象加密"的约束（只有 P1 的 KV L49/L51、P7 的 checkpoint L393 提到加密，与 P6 无关）。因此"精确遗忘达到 100%（含派生数据）"（L354）确实没有可执行的机制路径：crypto-shredding 只能销毁被加密对象的密钥，若派生摘要/embedding/倒排项以明文持久化，销毁源 key 不会删除已生成的派生内容；"级联失效"是逻辑失效/墓碑，不等于物理删除，也不覆盖备份、不可变段、导出副本。
2. Bemula（arXiv:2610.18052v1）摘要明确只做遗忘基准：5 个 suite 测 storage、removal of requested information、preservation、relearning、resistance to extraction attacks；没有测"派生摘要/embedding 是否随源 key 一起被 crypto-shred"，也没有密钥管理实验。它不能为"含派生数据的 100%"背书。摘要还说所有被测系统端到端通过率不超过 1.5%，多数为 0，这更说明把 100% 写成预期结果需要额外的机制论证。
3. 04 L362 自己承认"合规删除的'派生数据'边界难以定义"，L322 也承认"现有系统无法精确删除派生摘要"，但 L354 仍写死 100%，两者之间缺少桥接。这是典型的"表述过强/证据不足"（medium），不是事实错误（high）。

二、不准确/需要修正的部分
1. "与'派生摘要/索引/embedding 级联失效'的明文索引设计冲突"——原文从未写"明文"，这是从 L332/L335/L336 缺少加密字段推断出来的；更准确的说法是"未指定派生对象的加密归属，因而 crypto-shredding 的覆盖范围不可证"，而不是文本明说的冲突。
2. "Bemula 只评测遗忘请求"——摘要列出的 5 个 suite 包含 preservation、relearning 和 resistance to extraction attacks，已部分覆盖"删除后是否仍可被抽取"的残余泄漏；它确实不测派生摘要/embedding 的密钥删除，但"只评测遗忘请求"低估了 extraction-attack suite。
3. "要达 100% 需所有派生数据都用源派生密钥加密"——这是实现 100% 物理删除的一种（也是最可审计的）方式，但不是唯一方式；若能通过 `provenance_dag` 枚举并物理删除全部派生副本，也可达到。评审在建议里给了"或改为可证明删除所有可定位派生副本"的替代方案，所以整体建议成立，但问题陈述里的"需"过强。
4. 04 L5 已声明"预期结果标注为'目标'，不是已实现值"，L347 已把"删除精确率/召回率"列为主指标；因此"把目标当已实现值"或"缺少 precision/recall 指标"的批评不成立。真正的问题只剩 L354 的 100% 没有任何限定，且与 L334 的机制不匹配。

三、结论
核心问题（100% 含派生数据缺少密钥覆盖不变量；crypto-shredding 与逻辑级联失效被混用）成立，评审建议的修法方向正确；但"明文冲突"是从缺失字段推断的，"Bemula 只评测遗忘请求"不准确，且部分指标已存在。因此判 partially，最小修法是补一条存储不变量并把 100% 限定为"可定位副本范围内"，同时列出不可删除残余类型。
- **修正**：将 04-研究方案提案.md L334 替换为：
3. **遗忘与删除传播**：`forget(id | query | time_range)`；派生摘要/索引/embedding 经 `provenance_dag` 级联失效；**存储不变量**：所有持久化派生对象（摘要、embedding、倒排项）必须携带 `source_key_id`，并以源 key 派生的子密钥加密，销毁源 key 即 crypto-shred 其全部后代；不在该密钥树内的副本（备份、导出、第三方）必须登记为残余并单独处理。若不采用加密，则必须证明能枚举并物理删除全部派生副本，否则不得声称 100%。

将 L354 替换为：
- 精确遗忘：在可定位副本范围内达到 **100%**，并显式列出不可删除残余类型（备份/导出/模型参数中的记忆）及各自的处理策略；在 Bemula 上报告删除精确率/召回率与端到端通过率，不把绝对 100% 作为对外承诺。

（L322 作为问题证据可保留；L347 已有"删除精确率/召回率"，无需改动；L362 的风险描述可保留，但应与上述残余清单呼应。）

## 20. [partially/medium] 04-研究方案提案.md — P7 · 基线/预期结果（L405、L410）
- 说法：P7 预期 RTO 降低 50%，基线为 PyTorch DCP、ByteCheckpoint、TierCheck、对象存储整文件。
- 问题：FFTrainer 已报告最高 98% 恢复时间降低，且不在基线；LLMTailor 已做 layer-wise checkpoint 合并/筛选，2509.04084 已做低成本 differential checkpointing，二者都覆盖 P7 的“增量/manifest 组装”部分。P7 的 50% 目标低于 SOTA。
- 证据：FFTrainer（arXiv:2512.03644）：“reduces recovery time by up to 98%”；LLMTailor（arXiv:2602.22158）：“filters and assembles layers from different checkpoints”；2509.04084：“reuse gradients for low-cost differential checkpointing”。
- 复核理由：已核对 `research/raw/web/arxiv_raw.json` 的三条原始摘要，评审引用的三句话均准确：2512.03644 原文为 "reduces recovery time by up to 98% and mitigates GPU utilization loss by up to 68%"，机制是 "leverages surplus network capacity to quickly save and load states, thereby preventing rollbacks"；2602.22158 原文为 "a checkpoint-merging framework that filters and assembles layers from different checkpoints to form a composite checkpoint"，并明确给出 4.3× checkpoint size（Llama3.1-8B）与 2.8× checkpoint time（Qwen2.5-7B）；2509.04084 原文为 "reuse gradients for low-cost differential checkpointing"，sysnameplus 使用 "layer-wise-reuse snapshotting and incremental-merging persistence"。`04-研究方案提案.md` L405 的基线确实没有这三项，L410 的 50% 也没有说明与它们的关系，这是评审成立的部分。

但评审的推论有三处过度，不能判 confirmed：

1. "二者都覆盖 P7 的增量/manifest 组装部分"不准确。LLMTailor 只做按层筛选/合并，2509.04084 只做差分检查点；二者都没有 P7 L389 的 manifest 键（job/step/layer/expert/dtype/codec/checksum/base_ref/durability_class），也没有 L390 的 MVCC/GC 与 L391 的跨集群原子发布。`02-科研成果调研.md` L912 的原文是 LayerCheck、LLMTailor、MoC-System "都要求这种粒度"，不是"已经实现 manifest"；L842 还指出 LLMTailor 的局限是"跨检查点组装本身要读多个检查点"。评审把"需要按层粒度"当成了"覆盖 manifest 组装"。

2. "把 P7 的贡献聚焦到多版本 GC/跨集群原子发布，而非恢复时间"不是需要修改的偏差：`04` L397–399 的创新点已经写 vs ByteCheckpoint 做控制面与多版本语义、vs TierCheck 做生命周期与 GC；`01-领域全景与技术图谱.md` L166 的空白格也明确写"Checkpoint 的控制面 | manifest/GC/跨集群/原子提交"。P7 的贡献定位本来就是控制面，L410 只是把 RTO 放在预期结果第一条，造成了"以恢复时间为主"的错觉。

3. "P7 的 50% 目标低于 SOTA"是跨论文比较 P7 的目标与 FFTrainer 的 "up to 98%"；`00-方法论与证据说明.md` §2.3（L65）明确说"不同论文的 baseline、硬件、负载差异极大，跨论文直接比较加速比是没有意义的"。FFTrainer 的 98% 是 "up to"，且依赖剩余网络带宽、以避免回滚为前提，不能当作 P7 基线下的 SOTA 下界。正确说法是"P7 基线遗漏 FFTrainer，50% 的竞争力论证不足"，而不是"低于 SOTA"。

仍然成立、值得修的部分：P7 的基线应加入 FFTrainer 作为恢复时间 SOTA 参照（注明口径不同，不一定是可运行基线），并把 LLMTailor/2509.04084 加入增量/写放大参照；L410 的 50% 应注明比较集与故障域，或补一个 FFTrainer 不适用的跨集群/级联故障域结果。这样既回应评审，又不把 P7 的贡献错误地改成恢复时间。

附带核验：`02-科研成果调研.md` L842 称 LLMTailor/LayerCheck "两者摘要均未给出量化收益"，但 LLMTailor 摘要明确给出 4.3×/2.8×；这是 02 的事实错误（high），也说明 04 的基线遗漏不是无关紧要的编排问题。
- **修正**：最小修法（替换 `04-研究方案提案.md` P7 的 L405、L410；L397–399 的创新点不需要改写）：

L405 改为：
- 基线：PyTorch DCP、ByteCheckpoint、TierCheck、对象存储整文件；恢复时间另设 FFTrainer [arXiv:2512.03644] 为 SOTA 参照（摘要称最多降低 98% 恢复时间，但依赖剩余网络带宽、故障模型与 P7 不同，单列口径，不作跨论文换算）；写入放大另设 LLMTailor [arXiv:2602.22158] 与差分检查点 [arXiv:2509.04084] 为参照。

L410 改为：
- RTO 降低 **50%**（相对 DCP/ByteCheckpoint/TierCheck/整文件基线；若与 FFTrainer 同场，限定在相同故障域并计入 manifest/GC 开销，或改报 FFTrainer 不覆盖的跨集群/级联故障域，不把其 98% 的 "up to" 当作下界）。

可选一并修：
- L411 补注"按写入字节/有用状态字节计，与 LLMTailor 的 checkpoint size 缩减不是同一口径"；
- L381 后补一句"FFTrainer、LLMTailor 与 2509.04084 分别覆盖恢复、层组装与增量写；P7 的差异在 manifest 控制面、MVCC/GC 与跨集群原子发布"。

附带修正 `02-科研成果调研.md` L842（独立于本条评审）：
"LLMTailor 摘要报告 4.3× checkpoint size 缩减（Llama3.1-8B）与 2.8× checkpoint time 加速（Qwen2.5-7B）；LayerCheck 摘要未给出量化收益。"

## 21. [partially/medium] 04-研究方案提案.md — P7 · 问题与证据（L379）
- 说法：P7 用 AccelPact 的 +656.7% 延迟、32.5 GiB 主机内存、3.39 TB/hour 流量来论证 671B/1k–10k GPU 的 checkpoint 存储问题。
- 问题：这些数字来自 1.216B decoder 的 per-update 异步 checkpoint 测量；proposal 未注明规模，直接外推到 671B/千卡级，数量级依据不成立。
- 证据：AccelPact（arXiv:2609.18178）：“our measurements on a 1.216B-parameter decoder reveal that per-update asynchronous checkpointing incurs up to a +656.7% latency overhead, consumes 32.5 GiB of host memory, and generates 3.39 TB/hour”；P7 L379 引用。
- 复核理由：核对结果：评审者指出的一半成立，另一半是误读。

成立的部分：arXiv 摘要原文明确写的是 "our measurements on a 1.216B-parameter decoder reveal that per-update asynchronous checkpointing incurs up to a +656.7% latency overhead, consumes 32.5 GiB of host memory, and generates 3.39 TB/hour of storage traffic"（`d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json` L17883，curated-checkpoint-recovery.md L16 同文）。而 `d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md` L379 写成"每步异步检查点仍带来 +656.7% 延迟、32.5 GiB 主机内存、3.39 TB/hour 流量"，确实丢掉了"1.216B decoder"这一测量规模限定；同报告的 `02-科研成果调研.md` L819 就正确写明了"在 1.216B 参数 decoder 上"。在 P7 紧接 L378 的 671B 体积估算、且评测负载为 W7 千卡级（`raw/proposal-eval-framework.md` L17）的语境下，这个省略会误导读者把这些数字当作 671B/千卡级证据。因此"未注明规模"是真实缺陷，按"证据不足/表述过强"归 medium 可以接受。

不成立的部分：评审者称 P7 "直接外推到 671B/千卡级，数量级依据不成立"，这与原文不符。P7 的 671B 定量依据来自 L378 的独立一阶模型——"16 B/param、671B 约 10.7 TB、峰均比 77×"，其推导在 `raw/analysis-quant.md` §4（L408–L434 的 checkpoint 体积表给出 671B 10.74 TB，L485–L489 给出 τ/δ≈77×），与 AccelPact 无关；L379 只是引用 AccelPact 说明"异步检查点不免费"，并未用 656.7%/3.39 TB/hour 去推导 671B 的绝对流量。因此"数量级依据不成立"是过度指控，建议的"用 671B 的 checkpoint 体积/带宽模型重新推导"也属多余——该模型已经在 L378/analysis-quant 中存在。最小修法是只补测量规模并说明该数字的用途边界，不需要重算，也不需要改用 671B 级实测（现有公开材料中没有）。

结论：评审意见部分成立——漏标 1.216B 规模属实（medium 可保留），但"直接外推 671B、数量级依据不成立"是误读，原句并未做该外推。
- **修正**：- 每步异步检查点的开销在 **1.216B decoder** 上实测为 +656.7% 延迟、32.5 GiB 主机内存、3.39 TB/hour 流量 [arXiv:2609.18178]；该测量规模远小于 671B/千卡级，仅用于说明"异步不等于免费"，不作为 671B 绝对流量的外推依据（671B 体积见上条 16 B/param 模型）。

## 22. [confirmed/medium] 04-研究方案提案.md — P8 · 预期结果（L467）
- 说法：P8 预期“100 个 70B 变体从 14 TB 降到 ~144 GB（约 100×，基座 + LoRA）”。
- 问题：70B×2 B = 140 GB，仅基座就占 140 GB，144 GB 只剩 4 GB 给 99 个 LoRA（约 40 MB/个）。70B 的 rank-16 all-linear LoRA 约 0.4 GB/个，attention-only rank-16 约 0.13 GB/个；144 GB 隐含 rank≈4 的 attention-only LoRA，proposal 未给出该假设。
- 证据：P8 L467；14 TB = 100×70B×2 B；按 Llama-70B 80 层、hidden 8192、FFN 28672 估算 rank-16 all-linear LoRA ≈ 207M 参数 ≈ 0.41 GB/个，99 个 ≈ 41 GB，总计 ≈181 GB。
- 复核理由：已核对 d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md L467（P8「预期结果」，P8 全文 L429–481），并检索 d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json（1,877 条摘要）与 raw/analysis-quant.md。评审意见成立，medium 恰当。

一、数值复核。14 TB = 100 × 70B × 2 B = 100 × 140 GB（十进制，与原文 TB/GB 口径一致）；144 − 140 = 4 GB，分给 99 个 LoRA 约 40.4 MB/个。按 Llama-3-70B（80 层、hidden 8192、FFN 28672、8 个 KV head 即 1024）重算：rank-16 attention-only（q/k/v/o）= 65.5M 参数 ≈ 0.131 GB（bf16）；rank-16 all-linear（+gate/up/down）= 207.1M ≈ 0.414 GB；rank-4 attention-only = 16.4M ≈ 32.8 MB。99 × 32.8 MB ≈ 3.25 GB，加 140 GB ≈ 143.3 GB；若按 Llama-3-70B 实际约 70.6B 参数（基座 141.2 GB），合计 ≈ 144.4 GB。评审者「144 GB 隐含 rank≈4、仅 attention 的 LoRA」在数值上几乎精确。反过来，常规 rank-16 all-linear：140 + 99×0.414 ≈ 181 GB，14 TB/181 GB ≈ 77×；评审者的 181 GB 与 70–90× 区间也正确（rank-8 约 160 GB/87×，rank-32 约 222 GB/63×）。

二、来源复核。P8 的量化证据只有两篇 arXiv：2609.10266（KVShareArena，跨 context/checkpoint 的 KV 复用）与 2606.23969（Blackwell GPU 机密计算，吞吐损失 13–27%）；两篇摘要均无 LoRA 体积、14 TB 或 144 GB。全文检索 arxiv_raw.json 中含「144 GB」「14 TB」「180 GB」「181 GB」的摘要均为 0；02 报告里的多 LoRA 服务论文（2512.20210 Predictive-LoRA、2505.14468 ServerlessLoRA、2604.06370 ForkKV、2602.01053 LRAgent）摘要也只称 adapter「轻量」，没有体积数字。故 144 GB 在材料内无出处，是未标注假设的自拟投影；这也违反 00-方法论与证据说明.md §2.3「本报告推导值……标注假设」的要求。报告自己的 raw/analysis-quant.md L643 明确写「70B BF16 权重 140 GB」，L707 给出 Llama-3-70B 的 80 层/8192/64-8 架构，基座 140 GB 不是外部假设。

三、尝试反驳均失败。(a)「~」与「预期结果」可放宽：144 vs 181 差 26%，且把核心卖点 100× 变成 77×，不是舍入误差。(b) 也许按 4-bit 基座：4-bit 70B ≈ 35 GB + 99×0.414 ≈ 76 GB，不是 144 GB；若硬凑 144 GB，每个 LoRA 需 ≈1.1 GB（约 rank-40+ all-linear），同样未写明且不常见。且若走 4-bit 基座，公平基线应同时改为 100 份 4-bit 全量副本（约 3.5 TB），此时约 46×；直接用 14 TB fp16 基线会得到 184×，属于把「去重」和「量化」混比。(c) 也许 LoRA 也量化：4-bit LoRA 仍约 150 GB，要 144 GB 需 ~2-bit 或仅 q_proj 等更小配置，均未说明。(d) 也许变体不全是 70B：L467 明写「100 个 70B 变体」。(e) 也许跨变体 LoRA 去重：不同微调的 LoRA 权重基本不可去重，材料无证据。以上都无法把 144 GB 拉回常规假设。且 1 基座 + 99 LoRA 已是对提案最有利的口径；若「100 个变体（base + LoRA + 量化）」含多个基座或量化全量副本，181 GB 还会更大、倍数更低。

四、评审者的小瑕疵不影响结论：144 GB 并非唯一对应 rank≈4 attention-only（例如 rank-16 仅 q_proj 也可凑到约 144 GB），但这类配置同样不常规且未写明；「70–90×」只是示例区间，若 rank 取 64 会降到约 46×，所以修法重点应是「写明 rank/target/dtype 并给分解」，区间随假设走。综上判 confirmed，而非 partially/refuted；这是自拟预期值的内部不自洽与表述过强，不是对他人工作的误引，medium 合适。
- **修正**：替换 d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md L467 整行：

- 100 个 70B 变体从 14 TB 降到 **~181 GB（约 77×）**：按 1 份 fp16 基座 140 GB + 99 个 rank-16 all-linear LoRA（bf16，约 0.41 GB/个，共 ~41 GB）计；LoRA 取 rank-8/32 时分别约 160 GB（~87×）/222 GB（~63×）。

## 23. [partially/medium] 04-研究方案提案.md — P8 · 问题与证据/创新点/基线（L435–436、L454–456、L462）
- 说法：P8 称“学术界几乎没有系统研究”模型去重/分发，且“TensorCast 只提抽象，P8 做实现与评测”。
- 问题：Tangram 已做 tensor-level parameter sharing，gKSM 已做 GPU 内存去重，ServerlessLoRA 已做共享 backbone 的多 LoRA 服务，TensorCast 已设计并构建分布式 tensor 管理层的实现（不只是抽象）。P8 的 SOTA 判断过强，且冷启动目标 30–50% 低于 P-LoRA 已报告的 68%。
- 证据：Tangram（2512.01357）：“unified GPU memory pool for tensor-level parameter sharing across models”；gKSM（2610.25219）：“zero-copy model weight deduplication”；ServerlessLoRA（2505.14468）：“loads each backbone once, shares it read-only”；TensorCast（2608.06007）：“design and build TensorCast, a distributed tensor management layer”；P-LoRA（2512.20210）：“reducing cold start latency by up to 68%”。
- 复核理由：## 核对结果

五条 arXiv 摘要均在 `raw/web/arxiv_raw.json` 中真实存在，评审者引用的短语与摘要原文逐字吻合，不存在误读：

1. **TensorCast（2608.06007）**：摘要原文为 "We design and build TensorCast, a distributed tensor management layer... We integrate TensorCast with vLLM and SGLang and evaluate it... improves median TTFT by up to 93.2%"。P8 L456 写"它提抽象，P8 做实现与评测"是**事实错误**——TensorCast 不仅实现了，还集成了 vLLM/SGLang 并给出评测数字。此条应为 high。
2. **Tangram（2512.01357）**：摘要确有 "unified GPU memory pool for tensor-level parameter sharing across models"，并给出 6.2× 加载加速、冷启动 TTFT 降 23–55%。这是学术界的张量级跨模型参数共享系统。
3. **gKSM（2610.25219）**：摘要确有 "zero-copy model weight deduplication"，且 comment 为 "Accepted by SIGOPS ATC 2026"（已录用，非预印本），GPU 显存降 59.8%。这是学术界的权重去重系统。
4. **ServerlessLoRA（2505.14468）**：摘要确有 "loads each backbone once, shares it read-only across isolated LoRA functions"，TTFT 降最多 92.3%。这是学术界对"基座 + 多 LoRA 变体"共享的服务层系统研究。

因此 L436 的"学术界几乎没有系统研究"作为**无修饰的全称判断**确实过强：四篇都是学术系统工作，且直接针对模型权重/变体的去重与共享。评审者对这一点的核心判断成立。

但评审者**未注意到边界**：这四篇都不做存储层的张量级内容寻址与跨变体 delta——Tangram/gKSM 是 GPU 显存与驱动层，ServerlessLoRA 是服务状态层，TensorCast 是运行时张量生命周期抽象层而非持久化内容寻址存储。我在 `02-科研成果调研.md` 与全量抓取集合中检索，未发现存储层模型仓库去重/内容寻址的系统工作。所以"缺口在存储层"这一窄命题仍站得住，修法应是**限定口径**，不是撤回整个论断。

## 评审者的一处错误

"冷启动目标 30–50% 低于 P-LoRA 已报告的 68%"这一比较不成立：
- P-LoRA 的 68% 是 **adapter 从 host memory 预取到 GPU** 的冷启动降幅，基线是 reactive adapter loading（摘要：proactive prefetch "reducing cold start latency by up to 68%"，且是 "up to" 最好情况）。
- P8 的 30–50% 是**存储层变体加载**（含读时 dequantize/merge），基线是 safetensors 全量复制。
- 二者层次、基线、被测对象都不同，不能直接比大小。报告自己的 `00-方法论与证据说明.md` §2.3 明确写"不同论文的 baseline、硬件、负载差异极大，**跨论文直接比较加速比是没有意义的**"。评审者的这条子主张与报告方法论自相矛盾。

结论：主判断（SOTA 过强 + TensorCast 已实现）成立，应改；但"30–50% 低于 68%"不成立，修法应是**声明口径与基线**，而不是把目标数字抬高。

## 根因（值得一并修）

`02-科研成果调研.md` 对 Tangram（L944）、gKSM（L957）、TensorCast（L979）、ServerlessLoRA（L1005）均写"摘要未给出量化结果"，但 `arxiv_raw.json` 中这四篇摘要长度为 1114–1681 字符，量化数字出现在第 960–1624 字符处——正好在 02 所用的"900 字符处截断"之后。P8 的 SOTA 判断与被截断的摘要一致，属于继承了上游的证据缺失。此外 L436 的 `analysis/industry` 是悬空引用：该目录在仓库中不存在，且全仓库仅此一处出现。

## 严重度

按任务给的 high/medium/low 口径，TensorCast 那句是"事实错误"，应为 high；"几乎没有系统研究"属"表述过强"，medium；P-LoRA 比较不成立，不应写入。整条 finding 因混入了一个错误子主张，判 partially。
- **修正**：## 可直接替换的修正文本

### L435–436（问题与证据）替换为：

```
- 模型变体爆炸导致存储放大；safetensors 是事实标准但无系统级去重/版本语义。
- HuggingFace Xet 用 blob 级 CDC 去重，但不提供张量级变体语义与读时转码。
- 运行时层已有系统研究：Tangram 用 GPU 内存池做张量级跨模型参数共享 [arXiv:2512.01357]，gKSM 在驱动层做权重去重 [arXiv:2610.25219]，ServerlessLoRA 让多个 LoRA 只读共享同一 backbone [arXiv:2505.14468]，TensorCast 提供张量生命周期抽象层并已与 vLLM/SGLang 集成评测 [arXiv:2608.06007]。缺口在**存储层**：跨变体的可寻址 delta、张量级内容寻址与读时转码尚无系统工作。
```

（同时删掉悬空的 `` `analysis/industry` ``。）

### L454–456（创新点）替换为：

```
- vs Xet：Xet 做 blob 级 CDC，P8 做**张量级语义 + 读时转码**；
- vs safetensors：格式标准，P8 做**存储系统**；
- vs Tangram/gKSM/ServerlessLoRA：三者在 GPU 显存、驱动、服务层做运行时共享，P8 在**存储层**做内容寻址与跨变体 delta，互补而非替代；
- vs TensorCast：TensorCast 是运行时的张量生命周期层（已实现并与 vLLM/SGLang 集成评测），P8 做**持久化存储层的张量寻址、delta 与读时转码**。
```

### L462（基线）替换为：

```
- 基线：safetensors 全量复制、Xet、OCI artifact、TensorCast 权重物化路径 [arXiv:2608.06007]。
```

### L468（预期结果）替换为：

```
- 冷启动降低 **30–50%**（基线：safetensors 全量复制；P-LoRA 的 68% 是 adapter 从 host 预取到 GPU 的口径 [arXiv:2512.20210]，不与本指标直接比较）；
```

## 连带修正（02-科研成果调研.md，否则与 04 口径冲突）

把这四条的"摘要未给出量化结果"改为摘要原文数字：
- Tangram（L944）：加载快 6.2×，冷启动 TTFT 降 23–55%。
- gKSM（L957）：GPU 显存占用降 59.8%，吞吐 2.15×，集群服务率 99.97%。
- TensorCast（L979）：中位 TTFT 最多改善 93.2%。
- ServerlessLoRA（L1005）：TTFT 降最多 92.3%，延迟-成本效率为 vLLM-LoRA 的 1.66–3.01×。

P-LoRA 的 68% 在 02 中已正确，无需改。

## 24. [partially/medium] 04-研究方案提案.md — P9 · 一句话/创新点（L487、L510）
- 说法：P9 称要建立“第一个”KV 存储基准，“让不同系统第一次可以公平比较”。
- 问题：KVShareArena 已提供统一接口 + leaderboard + 四类评测视角；KV-Repurpose 已是 vLLM 上的非前缀复用 testbed；Boxoffice 已生成复用模式数据集；FailBench 已统一故障注入评测。P9 的“第一次公平比较”不成立，除非把范围严格限定为“存储层”（trace/寿命/故障）。
- 证据：KVShareArena（2609.10266）：“a common interface... interactive leaderboard”；KV-Repurpose（2610.13060）：“open-source, vLLM-based system for developing and evaluating segment-wise KV-cache reuse”；Boxoffice（2609.31415）：“programmatically generates evaluation datasets”；FailBench（2610.07688）。
- 复核理由：核对原始摘要后，评审意见的**结论方向成立，但证据有一处范畴错误，且对原句的限定词有误读**，因此判 partially。

1）确实成立的part：L487 后半句"让不同系统第一次可以公平比较"是无限定的绝对化表述。KVShareArena（2609.10266）摘要明确写"a benchmark and open evaluation framework for comparing them under the same conditions"、"a common interface for adding new methods and an interactive leaderboard"，并给出四类视角（answer quality、prefill computation、KV-cache memory、latency）。而且本报告自己在 04 文件 L38 写"跨上下文/跨 checkpoint 复用已经出现（KVShareArena）"、L57 写"vs KVShareArena：它做评测"——即文档已承认 KVShareArena 在做 KV 复用评测。这与 P9 的"第一次公平比较"直接冲突，属于内部不一致。更具体的是：P9 全节（L485–L520）只引了 2609.28870/2610.36355/2610.33076/2610.07688/2609.31415，**完全没有引用 2609.10266 与 2610.13060**，而这两个恰是最直接的先行工作。

2）评审意见的过头处（判 partially 的理由）：原句并非无范围，它已把"第一个"限定为"覆盖'块级 trace、复用距离、多租户、故障注入、寿命'的 KV 存储基准"。KVShareArena 比的是 11 种 repair/compression **方法**，指标是答案质量/prefill/显存/延迟，**没有**块级 trace、复用距离、life/TBW、存储设备故障注入、多租户存储，不能算"KV 存储基准"。02 文件"真实负载驱动的存储基准"一节列出的也只有 PRISM、LayoutBench、MLPerf HPC、列存格式，无一为 KV 存储基准。因此"第一个 KV 存储基准"在存储层意义上仍可成立；评审者建议改成的"第一个覆盖块级 trace/复用距离/寿命/故障注入的 KV 存储基准"与原句第一分句几乎同义，等于误读了原句、修法近乎空转，真正要改的是第二分句。

3）证据质量：KV-Repurpose（2610.13060）是"vLLM-based system for developing and evaluating segment-wise KV-cache reuse"——**单系统 testbed**，不是带 leaderboard 的跨系统基准，"统一接口+公平比较"的支撑力弱。Boxoffice（2609.31415）是"programmatically generates evaluation datasets"的数据集/方法论工具，也不是基准。FailBench（2610.07688）是**分布式训练**的容错评测（7 种训练架构、8 种 crash 容错机制、fail-stop），不是 KV 存储故障注入，P9 要的是 SSD 掉盘/GC 抖动/TBW 耗尽，属范畴错误——评审者把它列为反例是牵强的。

结论：应确认"第一次可以公平比较"这一绝对化表述需要收口，并补引 KVShareArena/KV-Repurpose 做分工；但不应接受"第一个 KV 存储基准"被推翻，也不应把 FailBench 当作 KV 存储故障评测的先行者。最小修法是只改第二分句 + 在 P9 补一条与 KVShareArena/KV-Repurpose/Boxoffice 的分工说明，而非照抄评审者那条近乎复述原句的改写。
- **修正**：文件：d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md

L487 原文：
**一句话**：建立第一个覆盖"块级 trace、复用距离、多租户、故障注入、寿命"的 KV 存储基准，让不同系统第一次可以公平比较。

替换为：
**一句话**：建立第一个面向存储层的 KV 基准——覆盖块级 trace、复用距离、多租户、故障注入与寿命/TBW，补上 KVShareArena 等方法级评测、KV-Repurpose 等单系统 testbed 未覆盖的存储指标与跨系统比较。

L510 原文：
- 第一个**以 KV 为中心**的存储基准（区别于 MLPerf Storage 的训练视角）；

替换为：
- 第一个**以 KV 存储层为中心**的存储基准：KVShareArena [arXiv:2609.10266] 已为复用方法提供统一接口与 leaderboard，KV-Repurpose [arXiv:2610.13060] 提供 vLLM 上的单系统 testbed，Boxoffice [arXiv:2609.31415] 提供复用数据集生成；但三者均不测块级 trace、复用距离、寿命/TBW 与存储设备级故障注入，也不做跨系统排序。

在 P9「问题与证据」末尾（L494 之后）补一条：
- 已有的 KV 复用评测（KVShareArena、KV-Repurpose、Boxoffice）统一了方法级的精度/延迟口径，但都不覆盖存储层指标；FailBench [arXiv:2610.07688] 覆盖的是分布式**训练**容错，而非 KV 存储的设备级故障注入。

## 25. [partially/medium] 04-研究方案提案.md — P10 · 技术路线/风险（L555–557、L582–584）
- 说法：P10 计划在 24 个月内用 FPGA/真实 CXL 设备实现设备可见 chunk、NAND→DRAM 进度与 claim/commit。
- 问题：这些能力需要 CXL-SSD 固件/设备侧可编程性；现货 CXL-SSD 不暴露这些接口（LM-CXD 本身是专用 CXL-SSD 研究设备）。proposal 的风险只说“厂商接口不统一”，但技术路线默认设备可改，时间线没有厂商合作/流片缓冲。
- 证据：P10 L555–557 要求设备暴露 NAND→DRAM 进度、维护受保护容量；L582–584 风险仅列“硬件可得性/厂商接口不统一”；LM-CXD（2609.26828）是“specialized CXL-SSD”而非现货。
- 复核理由：核对结果：评审者的核心关切成立，但证据表述有两处失实，故判 partially。

一、成立的部分（有原文支持）
1. arXiv:2609.26828 摘要原文为 "We present LM-CXD, a CXL-SSD specialized for LLM prefix caching. It makes KV chunks device-visible I/O units, exposes NAND-to-DRAM progress to the serving engine..."，且明确说 "a stock CXL-SSD remains about 3× slower than local DRAM and no faster than an NVMe SSD, while generic prefetching provides little benefit"。因此"现货 CXL-SSD 不提供设备可见 chunk/NAND→DRAM 进度，LM-CXD 是专用而非现货"成立。
2. proposal 04-研究方案提案.md L555–557 确实要求设备侧能力，L557 还要求"压缩在设备内完成"，比评审者点出的接口依赖更强；L582–584 没有任何缓解措施，也未点名"现货设备不暴露这些接口"这一具体缺口。
3. 评测设计（L569–572）写 "S4 仿真 + S1 原型"，但共享框架 raw/proposal-eval-framework.md L90 的 S1 是 "8×H100/H200、NVMe Gen5、RoCEv2 100–400 Gbps"，不含 CXL 设备，P10"原型"的硬件平台实际未定义，佐证硬件计划欠明确。

二、失实/夸大的部分
1. "proposal 的风险只说'厂商接口不统一'"不准确：L582–584 还列了"硬件可得性"和"仿真与真实差距"，"硬件可得性"已覆盖可编程硬件能否拿到。
2. "技术路线默认设备可改、时间线没有厂商合作/流片缓冲"是稻草人：L559 明写 "FPGA/真实 CXL 设备"，L588 的 M7–M14 就是 FPGA 原型。FPGA 原型正是实现设备侧语义且无需流片的常规路径；真正缺的是 CXL-FPGA 链路可行性 gate、M15–M20 用 FPGA 还是厂商设备的界定，以及失败回退，而非"没有缓冲"。
3. 摘要只说 "specialized"，未说"研究设备"；"研究设备"是合理推断但非原文事实。

结论：评审者指出的"设备可编程性依赖被风险章节低估、缺 gate 与退化方案"成立（medium），但其"风险只说厂商接口不统一""时间线没有缓冲""技术路线默认设备可改"三处表述与 L559/L582–584/L588 原文不符，因此不是 confirmed。最小修法：保留原三条风险，补上设备可编程性 gate、M15–M20 硬件边界与 stock 回退，不改变 P10 的 FPGA 路线。
- **修正**：【替换 L580–584】

### 风险与缓解

- **设备侧可编程性（关键前置）**：设备可见 chunk、NAND→DRAM 进度上报、受保护容量与设备内压缩都要求改控制器/固件；现货 CXL-SSD 不暴露这些接口，LM-CXD 本身也是面向 LLM 前缀缓存的专用 CXL-SSD 而非现货 [arXiv:2609.26828]。缓解：M1–M3 评估 CXL-FPGA 原型链路（板卡/IP/驱动/可达带宽），M4–M6 设 go/no-go gate；若不通过，退化为 host 侧 hint + 块层 QoS，不承诺 claim/commit 与设备内压缩。
- **真实设备与厂商合作**：M15–M20 若要在真实 CXL-SSD 上验证设备语义，须提前锁定能提供固件/接口支持的厂商；否则硬件评测限定为 FPGA 原型 + stock CXL-SSD 基线，并在结论中标注外推边界。
- **仿真与真实差距**：gem5+CXL 模型须用 FPGA 原型校准，分别报告仿真/原型/现货三档数字。

【替换 L588】

M1–M3 设备可编程性评估 + 仿真/接口；M4–M6 go/no-go gate + 接口定稿；M7–M14 FPGA 原型；M15–M20 硬件评测（以 FPGA 原型为主，真实 CXL-SSD 视厂商合作）；M21–M24 论文。

## 26. [confirmed/medium] 04-研究方案提案.md — P9 · 问题与证据（L491–492）
- 说法：P9 用“压缩组合不叠加 [2610.33076]”支持其基准中的压缩结论。
- 问题：该论文只在 Apple M5 Max/MLX 上评估 5 条 cache path，并明确说结果不能外推到更长上下文（32K 以上所有压缩变体退化到 1.5–14 tok/s）。把它当作一般性“压缩组合不叠加”证据是过度概括。
- 证据：2610.33076 摘要：“On Apple Silicon M5 Max... Sequential composition of FP4 and Polar yields no additive benefit... this result does not extend to longer contexts. At 32K and above, all compressed variants collapse to 1.5-14 tok/s”。
- 复核理由：独立核对结果支持该评审，核心判断成立。

一、原文与摘要逐项比对
- 目标句：`04-研究方案提案.md` L492「- 压缩组合不叠加 [arXiv:2610.33076]；FailBench 显示 checkpoint 机制无普适最优 [arXiv:2610.07688]。」（L491–492 即该 bullet）。
- 原始记录（`raw/web/arxiv_raw.json`，id 2610.33076v1，2026-10-21，cs.AR，11 页 3 表 0 图，单作者）：真实标题为 "Double KV Cache Optimization on Apple Silicon: Block-FP4, Radial Quantization, and Fused Metal Kernels"。摘要确实写："We evaluate five cache paths on an Apple Silicon M5 Max using MLX"；"Sequential composition of FP4 and Polar (Double Optimization) yields no additive benefit: 4,241 B/token at 15.1 tok/s, worse than FP4 alone on both axes"；"this result does not extend to longer contexts. At 32K and above, all compressed variants collapse to 1.5-14 tok/s"。评审引文与摘要一致，未误读、未混淆他作。
- 摘要只测两个轴：B/token 与 tok/s，全文未报告任何精度/困惑度指标；主结果所在模型与上下文长度均未在摘要给出，只可知 <32K（32K 以上全部退化）。因此该工作的有效证据域是"单设备、单实现、短上下文、仅速度与字节数"。

二、为什么不能反驳
- P9 的表述既丢掉了方法限定（FP4 与 Polar 串联），也丢掉了设备/上下文限定，把一次单点测量升格为"压缩组合不叠加"的一般规律；这正是 `00-方法论与证据说明.md` §2.3 自己禁止的做法（性能数字应作为"论文声称值"原样引用、不跨论文比较）。
- 我扫描了全部 1,866 条摘要中 non-additive / not additive / do not stack / orthogonal 等措辞，语料内没有第二篇支持"KV 压缩组合普遍不叠加"的工作；C²KV（curated-kv-compression）讲的是"压缩与非前缀复用粗暴组合会掉精度"，组合对象不同，不能补位。
- 报告内部还有两处旁证，说明这种过度概括是系统性而非笔误：`05-参考文献与索引.md` L135 把该文改题为 "On the Non-Additivity of KV Compression"（并非 arXiv 真实标题，属事实错误），"为什么必读"栏直接写"压缩组合不叠加"；`01-领域全景与技术图谱.md` L86、`02-科研成果调研.md` L2011、`03-优劣势总结报告.md` L131 也以同样无限定的口径引用。

三、评审本身的两处小瑕疵（不改变结论，不降级为 partially）
- "支持其基准中的压缩结论"用词不准：P9 的「技术路线/评测设计」并未给出任何压缩结论，该引用实际支撑的是「问题与证据」里的立论前提。这属于定位描述偏差，不影响缺陷成立。
- 摘要中 "this result does not extend to longer contexts" 在语法上紧接"fused Metal 路径有竞争力"一句；但紧随其后的 "At 32K and above, all compressed variants collapse" 明确覆盖全部压缩变体，"不能外推到长上下文"的判断在效果上成立。

四、严重度
维持 medium：不是凭空捏造（论文原句确有 no additive benefit），而是把受限条件下的单点结果写成一般性结论（证据不足/表述过强），而非 high 级事实错误。真正的事实错误在 `05-参考文献与索引.md` L135 的伪造标题，建议单独记为 high。
- **修正**：将 `04-研究方案提案.md` L492 整行替换为：

- 压缩组合的增益缺乏一般性证据：在 Apple Silicon M5 Max/MLX 单设备、短上下文（<32K）上，FP4 与 Polar 串联为 4,241 B/token、15.1 tok/s，在字节与吞吐两个维度都劣于单用 FP4；32K 以上所有压缩变体退化到 1.5–14 tok/s，该结果不可外推 [arXiv:2610.33076]——"压缩能否叠加"应作为本基准的待测假设（W 系列负载 × 压缩组合），而非既定结论。FailBench 显示 checkpoint 机制无普适最优 [arXiv:2610.07688]。

配套（同一缺陷的其他落点，建议一并限定口径，避免只改 P9）：
1. `01-领域全景与技术图谱.md` L86：把「甚至组合不叠加（…报告 FP4 与 Polar 串联后在两个维度都劣于单用 FP4）」改为「单设备短上下文下 FP4 与 Polar 串联未见叠加收益（…）」。
2. `02-科研成果调研.md` L2011：在「更关键的是组合并不叠加」前加限定「在 Apple Silicon M5 Max/MLX 单设备、<32K 上下文的一次测量中」。
3. `03-优劣势总结报告.md` L131：将「KV 压缩组合不叠加」改为「KV 压缩组合在该单设备短上下文实验中未叠加」。
4. `05-参考文献与索引.md` L135：题名 "On the Non-Additivity of KV Compression" 系杜撰，应改为真实标题 "Double KV Cache Optimization on Apple Silicon: Block-FP4, Radial Quantization, and Fused Metal Kernels"；"为什么必读"栏改为「单设备验证 FP4+Polar 串联无叠加收益，不可外推」。

## 27. [confirmed/medium] 04-研究方案提案.md — P9 · 时间线（L530–532）
- 说法：P9 计划 12 个月内完成 W1–W7 负载、M1–M16 指标、故障/寿命注入、vLLM/SGLang/LMCache/Mooncake 四个 adapter、5–10 系统 case study 与论文。
- 问题：以报告建议的 3–5 人团队（L7），12 个月内同时完成四套系统 adapter + 真实 trace 获取 + 5–10 系统复现不现实；风险 L526 也承认真实 trace 需产业合作。
- 证据：P9 时间线 L530–532；选择建议 L7“若团队只有 3–5 人，优先做 P1/P3/P9”；风险 L526“真实 trace 获取困难（需产业合作）”。
- 复核理由：核对后评审的三处引用全部属实，没有误读。`04-研究方案提案.md` L502–506 把 W1–W7 负载、M1–M16 指标、故障/寿命注入、vLLM/SGLang/LMCache/Mooncake 四个 adapter 全部写进 P9 技术路线；L514–516 要求用 5–10 个系统做 case study；L530–532 的 12 个月时间线里，M8–M10 只有 3 个月做四套参考实现，M11–M12 只有 2 个月做 5–10 系统 case study 与论文；L526 明确写"真实 trace 获取困难（需产业合作）"；L7 把 P9 列为 3–5 人团队的首选。L522 的预期结果"揭示 3–5 个论文收益在真实 trace 下消失的案例"更把结论绑定在尚未到手的真实 trace 上。更强的内部证据是 L618–627 的 24 个月路线图：只在 Q1–Q2 给 P9 安排"基准格式"，之后不再出现 P9——作者自己的总路线图事实上只把 P9 当作 6 个月的格式交付，与 P9 章节的 12 个月全量计划自相矛盾。arXiv 侧不影响该结论：P9 引用的 [2609.28870]、[2610.36355]、[2610.33076]、[2610.07688]、[2609.31415] 摘要均支持"缺统一基准"的前提，其中 [2609.31415] 的 Boxoffice 反而说明复用数据集本身需要专门构建，不会缩短工程量。唯一可争之处是"不现实"对 5 人且有现成 harness 的团队略强，但对 3 人下限、且要同时做四套 adapter 与真实 trace 的情形成立；且评审建议的 vLLM + LMCache 并不是两个可独立比较的系统（LMCache 是 vLLM 的 KV 存储层），首版若要支撑"不同系统公平比较"，需明确写成"vLLM APC 栈 vs vLLM+LMCache 栈"，或第二 adapter 改用 SGLang。综合判 confirmed（medium）。
- **修正**：【替换 L530–534】

### 时间线（12 个月，交付 v0.1）

12 个月只承诺 **v0.1**：trace 格式、3 个负载、4 个核心指标 + 最小可观测性、2 个 adapter、3–5 系统 case study 与短文；W1–W7 / M1–M16 全覆盖、5–10 系统与正会全文放到第二阶段。

- M1–M3：trace 格式 v0.1（请求、token 序列、prefix graph、KV 块访问、复用距离、租户、SLO）+ M1/M5/M7/M11 的标准实现与三种命中率口径；M15 的 TTFT 分解与慢节点定位作为可观测性最小集。
- M4–M7：W1/W2/W5 三个负载 + 合成生成器；故障/寿命注入做原型（SSD 掉盘、GC 抖动、TBW 耗尽），先在 FEMU 上验证；真实 trace 以公开的 Mooncake/BurstGPT/Azure 请求级 trace 起步，块级 trace 依赖产业合作，未到位时用合成 trace 并在结果中显式标注。
- M8–M10：vLLM 与 LMCache 两个 adapter 与一键复现脚本；SGLang/Mooncake adapter 作为 stretch goal。
- M11–M12：开源工具链 + 3–5 个系统的 case study（至少 1 个集群级部署）+ measurement track 短文。

**第二阶段（M13–M24）**：补齐 W3/W4/W6/W7、M2–M4/M6/M8–M10/M12–M14/M16、SGLang/Mooncake adapter、5–10 系统 case study 与正会全文；真实块级 trace 的获取与脱敏是进入第二阶段的里程碑门禁。

**目标会议**：MLSys / NSDI（measurement track）短文；完整版 FAST。

【配套改动，保持全文一致】
- L7 改为："若团队只有 3–5 人，优先做 P1/P3/P9（P9 只做 v0.1）。"
- L621 改为："Q1-Q2   P9 trace 格式 v0.1 + P1 对象模型 + P3 寿命模型（可并行，低依赖）"；L622 改为："Q3-Q4   P9 v0.1（W1/W2/W5 + M1/M5/M7/M11 + vLLM/LMCache adapter）+ P1 单机原型 + P3 门控原型 + P5 仿真"。
- 若坚持首版只做 vLLM + LMCache，需在"评测设计"中明确比较对象是"vLLM APC 栈 vs vLLM+LMCache 栈"而非两个独立引擎；否则建议第二 adapter 改用 SGLang，保留跨引擎可比性。

## 28. [confirmed/high] 00-方法论与证据说明.md — §2.1 检索环境表，第 40 行“1,866 篇去重论文”
- 说法：00 声称 arXiv 检索去重后为 1,866 篇。
- 问题：该数字与 README、02、03 的 1,877 篇矛盾，也与原始抓取数据不一致；00 是唯一写 1,866 的文档。
- 证据：raw/web/arxiv_raw.json 共 1,877 条记录、1,877 个唯一 ID；README 第 5、91 行、02 第 5 行、03 第 4 行均写 1,877；00 第 40 行写 1,866。
- 复核理由：独立核对后，评审意见的核心事实成立，无法反驳：

1. 原始数据：`d:/xiaojun/work/test/StoreAI/research/raw/web/arxiv_raw.json` 实际为 1,877 条记录，唯一 arXiv ID 也是 1,877 个（0 重复）。README 第 5、91 行、`02-科研成果调研.md` 第 5 行、`03-优劣势总结报告.md` 第 4 行均写 1,877；`00-方法论与证据说明.md` 第 40 行确实写 1,866，与数据及其余主文档不一致。

2. 1,866 的来源已查明，它不是"筛选后口径"，而是加回经典文献之前的中间态：`research/raw/web/fix_classics.log` 末行为 "added 2; total 1866"，随后 `research/raw/web/restore_classics.log` 末行为 "restored 11, total 1877"。即 1,866 是 restore_classics.py 运行前的旧总数，补录 11 篇后最终集合为 1,877。`00` 第 40 行只是没有随最终数据更新，因此不需要注明任何筛选条件。

3. 另核对各 curated 子集（curated-all.json 为 400 条，分方向合计约 808 条），没有任何子集等于 1,866，可排除"另一种统计口径"的可能。

评审意见中有一处细节需要修正：说"00 是唯一写 1,866 的文档"不准确——`d:/xiaojun/work/test/StoreAI/research/raw/_index.md` 第 10 行也写"1,866 篇"。该文件同属陈旧文案，应一并改为 1,877，否则修完 00 仍残留矛盾。这不影响本条 finding 成立，只是修法范围应更大。

附带发现（不属于本条评审主张，供作者另行核实）：同一行"最早 2019"也与 `arxiv_raw.json` 不符，数据集中最早条目为 1995-06-08（hep-ph 检索噪声）。若"最早 2019"指的是相关文献窗口，建议明确措辞；本次最小修法只改数字，不擅自改动该表述。
- **修正**：将 `d:/xiaojun/work/test/StoreAI/research/00-方法论与证据说明.md` 第 40 行整行替换为：

| **arXiv 官方 API** | `export.arxiv.org/api/query`，47 组查询，覆盖 15 个子方向 + 按提交日期的最新扫描 | **1,877 篇去重论文**，最早 2019、最新 **2026-10-30** |

同时将 `d:/xiaojun/work/test/StoreAI/research/raw/_index.md` 第 10 行的"1,866 篇"改为"1,877 篇"，使与最终抓取数据一致。

## 29. [confirmed/medium] 00-方法论与证据说明.md — §2.1 检索环境表，第 40 行“最早 2019”
- 说法：00 称检索集合最早为 2019 年。
- 问题：05 的年份分布和 05a 的明细都包含 2016/2018 年条目，原始抓取数据的最小日期更早；该范围陈述与清单矛盾。
- 证据：05 第 5 行年份分布为 2016:1、2018:2、2019:1；05a 第 527–529 行日期分别为 2018-12-03、2018-11-14、2016-11-18；arxiv_raw.json 最小 published 为 1995-06-08。
- 复核理由：我按"先尝试反驳"的顺序核对，未找到可推翻该意见的理由，反而逐项坐实：

1) 被质疑句确为 `d:/xiaojun/work/test/StoreAI/research/00-方法论与证据说明.md` 第 40 行："**1,866 篇去重论文**，最早 2019、最新 **2026-10-30**"。该单元格描述的是 arXiv API 抓取集合的规模与时间范围，不是某个"LLM 时代子集"的范围，因此"最早 2019"应理解为整个抓取集合的最早出版日期。

2) `05-参考文献与索引.md` 第 5 行原文："2026 年 303 篇、2025 年 154 篇、2024 年 42 篇、2023 年 11 篇、2022 年 8 篇、2021 年 3 篇、2020 年 4 篇、2019 年 1 篇、2018 年 2 篇、2016 年 1 篇"——与评审者所述完全一致。

3) `05a-完整文献表.md` 中对应三条为表内序号 527–529（实际文件行 535–537；评审者用的是表格行号而非文件行号，属无害的定位口径差异）：1812.00669 Hoard，2018-12-03；1811.05922 Bandana，2018-11-14；1611.06224 ModelHub，2016-11-18。

4) `raw/web/arxiv_raw.json` 实测：1877 条、1877 个唯一 ID，`published` 最小值 `1995-06-08T21:50:52Z`，最大值 `2026-10-30T17:50:49Z`。评审者给的 1995-06-08 准确。

5) 关键的"反驳尝试"也失败：我检查了 1611.06224、1812.00669、1811.05922 的 `provenance`，三者均来自 47 组查询中的 `training-data-fs` 维度（`(abs:"distributed file system" OR abs:"storage system") AND (... abs:training)`，rank 1），不是后来人工补种的 classic-seed。也就是说，即便只看最初的 API 检索结果，"最早 2019"也已不成立；1995 条目同样是该查询返回的真实结果（宽 OR 查询带来的噪声）。

6) 唯一可争辩点是：1995–2015 的若干条目多为宽查询噪声，若作者本意是"被引集合"或"相关文献"，应写明限定语；但原文并无此限定，且被引集合最早也是 2016，仍不是 2019。因此该说法确属"事实错误/表述与清单矛盾"，定级 medium 合理（属于范围元数据错误，不影响技术结论）。

附带发现（不改变本条判定）：00 第 40 行的"1,866 篇"也已过期——`raw/web/arxiv_raw.json` 当前为 1877 条，`README.md`、`02`、`03` 均写 1,877；`restore_classics.log` 显示 17:10 恢复了 11 篇，而 00 的 mtime 为 17:06。若一并修正该单元格，建议把数量同步为 1,877；若只想最小改动，保留 1,866 也不算本条的判错点。
- **修正**：将 `d:/xiaojun/work/test/StoreAI/research/00-方法论与证据说明.md` 第 40 行整行替换为：

| **arXiv 官方 API** | `export.arxiv.org/api/query`，47 组查询，覆盖 15 个子方向 + 按提交日期的最新扫描 | **1,866 篇去重论文**，最新 **2026-10-30**；被引集合最早 2016（`[arXiv:1611.06224]`），抓取集合最早 1995（含宽查询带来的检索噪声） |

## 30. [confirmed/medium] 05-参考文献与索引.md — §2 标题第 20 行“必读 60 篇”；清单 #1–#70 第 28–137 行
- 说法：05 §2 的必读清单标题为“必读 60 篇”。
- 问题：清单实际有 70 个编号条目（#1–#70），README 第 43 行也写“必读 70 篇”；标题与内容和 README 都不一致。
- 证据：05 第 20 行标题；第 28–137 行为 #1–#70 共 70 行；README 第 43 行“必读 70 篇”。
- 复核理由：逐项独立核对，被质疑的说法全部属实：

1. 05 文件第 20 行确为 `## 2. 必读 60 篇（按主题）`。
2. 清单确为 70 个编号条目：#1 在第 28 行，#70 在第 137 行；用脚本按 `^\| (\d+) \|` 统计得 70 行，编号连续无缺。各小节标注的数目相加也是 70（A 10 + B 12 + C 8 + D 9 + E 9 + F 7 + G 5 + H 6 + I 4 = 70）。
3. README 第 43 行确为 `必读 70 篇、工业一手资料、核验方法`。

因此标题的“60”与正文 70 条、README 的“70”三方不一致，标题是陈旧数字，评审者没有误读。评审者建议的严重度 medium 恰当：这是文档内部计数不一致，不涉及 arXiv 条目本身真伪。

补充一个评审者没发现、但会强化而非推翻该结论的细节：清单中 #60（KVShareArena，2609.10266）与 #37 是同一篇，行内已标“（同 37）”。所以 70 个条目实际只有 69 篇唯一论文。这意味着 README 的“必读 70 篇”若按“唯一论文”理解也偏高 1；最小且自洽的修法是把标题改成“70 篇/条”与 README 对齐（承认 70 个条目），或删掉 #60 后把 05 与 README 同改为 69。评审者“删减 10 条只留 60”的备选修法成立但非必要。

另需指出评审者修法中的一处多余步骤：要求“同步 00”。实际检索 research 目录全部 .md，只有 05 第 20 行和 README 第 43 行出现 60/70 篇计数，`00-方法论与证据说明.md` 并不含该数字，无需同步 00。

未涉及 arXiv 摘要层面的争议，故 raw/web 数据不改变结论。
- **修正**：将 `05-参考文献与索引.md` 第 20 行替换为：

## 2. 必读 70 篇（按主题）

README 第 43 行已是“必读 70 篇”，无需改动；`00-方法论与证据说明.md` 不含该计数，无需同步。

可选的一步去重（若希望“篇”严格等于唯一论文数）：删除第 117 行 `| 60 | KVShareArena（同 37） | 2609.10266 | 跨变体复用的评测 |`，将 G 节标题“（5）”改为“（4）”，并把 05 第 20 行与 README 第 43 行同步改为“必读 69 篇”。若不做去重，建议把标题写成“必读 70 条（按主题）”，以避免“70 篇”把重复条目计为一篇。


# 低严重度 findings（未复核）

## [low] 03-优劣势总结报告.md — §4.1 技术雷达表，第366行
- 说法：「缓存侧信道防护 | 试点 | PROMPTPEEK [arXiv:2608.09225]」——把 PROMPTPEEK 当作防护方案。
- 问题：[2608.09225] 的论文是 KVGov（防护机制），PROMPTPEEK 只是它引用的三类攻击之一。把攻击名当作防护代表工作、并用该 ID 指代，属于张冠李戴。
- 建议：改为「KVGov [arXiv:2608.09225]」；若要保留 PROMPTPEEK，应作为被防护的攻击单独引用其原始论文。

## [low] 03-优劣势总结报告.md — §2 元发现，第131行
- 说法：「LRU 在 agent 密集场景比 S3FIFO 高 12%，其他场景低至 22%」。
- 问题：原文是「trails it by up to 22% elsewhere」（最多落后 22%）；「低至 22%」在中文里读作「LRU 命中率只有 22%」，与原文含义不同。
- 建议：改为「其余场景最多落后 22%」。

## [low] 03-优劣势总结报告.md — 执行摘要第5条，第19行（01-领域全景与技术图谱.md 第106行同述）
- 说法：「checkpoint 的 bytes/FLOP 比数据加载高 10³–10⁴ 倍」。
- 问题：报告自己的 analysis-quant §6.1 表格给出 405B=5.6×10⁴、671B=8.9×10⁴，即最高接近 10⁵；「10³–10⁴」对大模型低估约一个数量级。
- 建议：改为「10³–10⁵ 倍（随模型规模上升）」。

## [low] 03-优劣势总结报告.md — §3.11 劣势，第296行
- 说法：「机密计算下 DMA 假设失效（吞吐损失 13–27%）」——全段无引用。
- 问题：数字本身正确，但报告第465行承诺所有量化结论可追溯到 analysis-quant 或原始摘要，此处两者都没有给出。
- 建议：补 [arXiv:2606.23969]。

## [low] 01-领域全景与技术图谱.md — §4.8 未解，第124行
- 说法：「全量重建写 3–5 TB」。
- 问题：3.07 TB 可由 10 亿×768×4B 直接算出，但「写 3–5 TB」没有任何来源；vector 语料与 02 中都没有这个区间，属于未标注的估算。
- 建议：标注「估算」并给出假设（如索引/副本/中间态倍数），或删除区间。

## [low] 03-优劣势总结报告.md — §2 发现8，第113行
- 说法：「FailBench 横评 142 个组合后结论是……（磁盘稳态开销 0.5%，内存复制恢复约 17 ms）」。
- 问题：这两个数字是 A2 单一架构上的结果，原文明确写「on A2」；报告把它紧接在「142 个组合横评」之后，容易被读成全局结论。
- 建议：加「（A2 架构上）」。

## [low] 01-领域全景与技术图谱.md — §1 一句话结论，第13行
- 说法：「KV 约 1.25 TiB，需要约 9 张 H200 仅用于放 KV」。
- 问题：按报告自己的口径（1.25 TiB=1280 GiB=1374 GB，H200=141 GB），需要 9.75 张，即 10 张；「约 9 张」按 141 GiB 才成立，存在 GB/GiB 混用。
- 建议：改为「约 10 张（按 141 GB 口径）」，或统一用 GiB。

## [low] 04-研究方案提案.md — P1 · 技术路线/时间线/选择建议（L7、L79–84）
- 说法：P1 建议 3–5 人团队优先做，并在 18 个月内完成对象模型、FoundationDB 元数据、版本/失效、vLLM/SGLang 集成、集群多租户与真实 trace 评测。
- 问题：范围过大：事务型元数据 + 反向索引删除传播 + 两套引擎 connector + 集群多租户 + 真实 trace，18 个月/3–5 人风险高；时间线没有为 FoundationDB 运维、跨引擎语义差异留缓冲。
- 建议：首版只做 vLLM connector + 单机 NVMe + 元数据原型，把 SGLang/集群/多租户放到第二阶段；或把 P1 的时间线改为 24 个月。

## [low] 04-研究方案提案.md — P9 · 预期结果（L520–522）
- 说法：P9 预期“成为社区事实标准”“把评测成本降低 10×”。
- 问题：这两个目标不可测：“事实标准”无验收指标，“10×”没有定义基线（相对于什么评测流程、什么人力/时间）。
- 建议：改为可测目标：例如“复现一个已发表系统结果所需人时从 X 降到 Y”“同一 trace 下 5 个系统的排序与各自论文报告一致”。

## [low] 05-参考文献与索引.md — §2 必读表 #30 第 67 行、#37 第 79 行、#60 第 117 行
- 说法：05 §2 的 70 条必读条目都是可用 arXiv ID 核验的论文。
- 问题：#30 的 arXiv 列填的是“EMNLP 2024 Findings”，没有 ID；#60 与 #37 是同一篇 2609.10266（KVShareArena）。70 行实际只有 68 个唯一有效 arXiv ID，#30 也不在 05a 的 529 条清单中。
- 建议：为 #30 补 arXiv ID，或标注“非 arXiv（会议论文）”并移出 arXiv 列；将 #60 换成不同论文，或注明“同 #37，不重复计数”并把标题/计数改为 69 篇（68 个唯一 ID）。

## [low] 05-参考文献与索引.md — §4 标题第 156 行及表第 158–169 行
- 说法：05 §4 声称列出“引用最多的 20 篇（按出现次数）”。
- 问题：表只有 10 行（排名 1–10），且“出现次数”列全部写“高频”而非实际次数，无法支撑“按出现次数”的排序。
- 建议：标题改为“引用最多的 10 篇（定性）”并去掉“按出现次数”；或补足 20 行并用 verify_citations.py 输出实际计数。

## [low] 03-优劣势总结报告.md — §4.2 标题第 368 行及表第 370–376 行
- 说法：03 §4.2 称产业格局为“四种路线”。
- 问题：表实际列出 5 条路线：加速器厂商、模型公司、云厂商、存储厂商、API 厂商；标题的“四种”与表格数量不符。
- 建议：标题改为“五种路线”，或把 API 厂商并入云厂商并说明合并理由。

## [low] 03-优劣势总结报告.md — §3 引言第 139 行（成熟度定义）与 §4.1 表第 353–366 行
- 说法：03 用统一的四档成熟度（实验/早期采用/规模化/标准化）评价技术族。
- 问题：§4.1 技术雷达改用“已量产/早期量产/试点/原型/研究/降温”另一套标签；同一技术在不同节被标成不同档，例如 SSD-backed KV 在 §3.2 是“早期采用 → 规模化”、§3.14 是“早期→规模化”、§4.1 却是“已量产”。
- 建议：统一使用 §3 的四档量表，或在 §4.1 前给出两套标签的映射，并把“已量产/试点/原型/研究/降温”映射回四档。

## [low] 00-方法论与证据说明.md — §4 第 122 行；同一表述见 01 §3 第 68 行
- 说法：两处把研究方案称为“第四章”。
- 问题：报告以文件编号组织（04 才是方案），00 的 §4 是“与既有综述的差异”、01 的 §4 是“九个研究簇”；“第四章”会被误读为当前文件的第 4 节，交叉引用失效。
- 建议：改为“04-研究方案提案.md”或“见文件 04”。

## [low] 00-方法论与证据说明.md — 第 63 行；同问题见 01 第 181 行、04 第 378 行和第 436 行
- 说法：文档中的 raw 数据路径可直接打开。
- 问题：多处只写 analysis-quant.md，而实际文件是 research/raw/analysis-quant.md；04 第 436 行写 analysis/industry，仓库中不存在该路径，实际是 research/raw/analysis-industry.md。
- 建议：统一写成 raw/analysis-quant.md 和 raw/analysis-industry.md；04 第 436 行改为 raw/analysis-industry.md。

## [low] 01-领域全景与技术图谱.md — §4.8 第 122 行
- 说法：01 用 [arXiv:2111.08566] 同时标注 DiskANN 与 SPANN。
- 问题：2111.08566 是 SPANN；05 §5 明确把 DiskANN (NeurIPS'19) 列为无 arXiv 版本的经典，05 #56 也只把该 ID 给 SPANN。并列写法会让读者误以为 DiskANN 也有这个 arXiv ID。
- 建议：改为“DiskANN（NeurIPS'19，无 arXiv）/ SPANN [arXiv:2111.08566]”。

## [low] 00-方法论与证据说明.md — 第 14 行；另见 01 第 96/98 行、03 第 11/141/333/355 行
- 说法：全文对 KV Cache、PD 分离、offload 等术语使用统一写法。
- 问题：00 同一句先用“KV Cache”后写“KVCache”；01 §4.4 标题写“PD 解耦”，正文写“prefill/decode 分离”，其他节写“PD 分离”；offload 与“卸载”在不同段落交替出现（如 03 第 11 行 offload、第 141 行“卸载”）。
- 建议：在 00 §1 或术语表固定写法（建议“KV Cache”“PD 分离”“卸载（offload）”），全文替换；论文标题中的 KVCache 保留原样。

## [low] proposal-eval-framework.md — 第 3 行；同文件第 51–64 行
- 说法：评测框架头部声明编号为 W1–W7 / M1–M9 / B1–B6 / S1–S5。
- 问题：同一文件实际定义到 M16（第 51–64 行），04 第 5 行也引用 M1–M16；头部的 M1–M9 是旧口径，会让读者漏掉 M10–M16。
- 建议：把头部改为 W1–W7 / M1–M16 / B1–B6 / S1–S5。

## [low] 01-领域全景与技术图谱.md — §6 空白格，第171行
- 说法：01 把“多模态/视频生成的存储”列为“仍处于早期”的空白格（P12 探索），但 02 §2.15 已用 10+ 篇论文综述长视频/世界模型的记忆（MAG、TetherCache、OmniMem、SMART、Honeycomb、SMI、SlotMem、EM-Vid、MemCam、GIM-World 等）。
- 问题：“空白”与“已有整节综述”自相矛盾；真正的空白不是视频记忆，而是视频 latent/素材/数据集的存储层（对象布局、版本、时序索引、训练数据管道）。把它标为空白会误导读者，也让 P12 显得没有基础。
- 建议：补什么：把空白格改为“视频 latent/素材的对象存储与版本化、时序索引、训练数据布局”，把已综述的记忆工作移到具名研究簇；P12 改写为“视频资产/latent 存储”并把 02 §2.15 的证据作为基础。放哪节：01 §6、04 P12、02 §2.15 开头。为什么：消除内部矛盾，准确区分“记忆机制”与“存储层”，让 P12 的研究缺口成立。
