package com.smartbookkeeper.app.util

import com.smartbookkeeper.app.data.entity.PaymentSource
import com.smartbookkeeper.app.data.entity.Transaction
import com.smartbookkeeper.app.data.entity.TransactionType

object NotificationParser {

    fun parse(packageName: String, content: String): Transaction? {
        return when (packageName) {
            "com.tencent.mm" -> parseWechat(content)
            "com.eg.android.AlipayGphone" -> parseAlipay(content)
            "com.chinamworld.main",
            "com.icbc",
            "com.android.bankabc",
            "com.chinamworld.bocmbci",
            "com.cmbchina.ccd.pluto.cmbActivity" -> parseBank(content, packageName)
            "com.unionpay" -> parseUnionPay(content)
            else -> parseGeneric(content, packageName)
        }
    }

    private fun parseWechat(content: String): Transaction? {
        val amountRegex = Regex("""(\d+\.?\d*)\s*元""")
        val payeeRegex = Regex("""(?:向|付款给|转账给|收款方[：:]\s*)([^\s,，。]+)""")
        val incomeRegex = Regex("""(?:收款|到账|收入|转入).*?(\d+\.?\d*)\s*元""")

        val amountMatch = amountRegex.find(content) ?: return null
        val amount = amountMatch.groupValues[1].toDoubleOrNull() ?: return null

        val isIncome = incomeRegex.containsMatchIn(content)
        val payeeMatch = payeeRegex.find(content)
        val description = payeeMatch?.groupValues?.get(1) ?: ""

        return Transaction(
            amount = amount,
            category = if (isIncome) "收入" else guessCategory(description, content),
            description = description,
            type = if (isIncome) TransactionType.INCOME else TransactionType.EXPENSE,
            paymentSource = PaymentSource.WECHAT,
            isAutoRecorded = true
        )
    }

    private fun parseAlipay(content: String): Transaction? {
        val amountRegex = Regex("""(\d+\.?\d*)\s*元""")
        val payeeRegex = Regex("""(?:向|付款给|转账给|对方[：:]\s*)([^\s,，。]+)""")
        val incomeRegex = Regex("""(?:收款|到账|收入|转入|余额宝).*?(\d+\.?\d*)\s*元""")

        val amountMatch = amountRegex.find(content) ?: return null
        val amount = amountMatch.groupValues[1].toDoubleOrNull() ?: return null

        val isIncome = incomeRegex.containsMatchIn(content)
        val payeeMatch = payeeRegex.find(content)
        val description = payeeMatch?.groupValues?.get(1) ?: ""

        return Transaction(
            amount = amount,
            category = if (isIncome) "收入" else guessCategory(description, content),
            description = description,
            type = if (isIncome) TransactionType.INCOME else TransactionType.EXPENSE,
            paymentSource = PaymentSource.ALIPAY,
            isAutoRecorded = true
        )
    }

    private fun parseBank(content: String, packageName: String): Transaction? {
        val amountRegex = Regex("""(\d+\.?\d*)\s*元?""")
        val amountMatch = amountRegex.find(content) ?: return null
        val amount = amountMatch.groupValues[1].toDoubleOrNull() ?: return null

        val isIncome = content.contains("存入") || content.contains("转入")
                || content.contains("收入") || content.contains("到账")

        val source = when (packageName) {
            "com.icbc" -> PaymentSource.BANK_CARD
            else -> PaymentSource.BANK_CARD
        }

        return Transaction(
            amount = amount,
            category = if (isIncome) "收入" else "银行支出",
            description = content.take(50),
            type = if (isIncome) TransactionType.INCOME else TransactionType.EXPENSE,
            paymentSource = source,
            isAutoRecorded = true
        )
    }

    private fun parseUnionPay(content: String): Transaction? {
        val amountRegex = Regex("""(\d+\.?\d*)\s*元?""")
        val amountMatch = amountRegex.find(content) ?: return null
        val amount = amountMatch.groupValues[1].toDoubleOrNull() ?: return null

        return Transaction(
            amount = amount,
            category = "银联消费",
            description = content.take(50),
            type = TransactionType.EXPENSE,
            paymentSource = PaymentSource.BANK_CARD,
            isAutoRecorded = true
        )
    }

    private fun parseGeneric(content: String, packageName: String): Transaction? {
        val amountRegex = Regex("""(?:支付|消费|扣款|付款|支出)[^\d]*(\d+\.?\d*)\s*元""")
        val amountMatch = amountRegex.find(content) ?: return null
        val amount = amountMatch.groupValues[1].toDoubleOrNull() ?: return null

        return Transaction(
            amount = amount,
            category = "其他消费",
            description = content.take(50),
            type = TransactionType.EXPENSE,
            paymentSource = PaymentSource.OTHER,
            isAutoRecorded = true
        )
    }

    private fun guessCategory(description: String, content: String): String {
        val categoryMap = mapOf(
            "餐饮" to listOf("美团", "饿了么", "外卖", "餐厅", "饭店", "咖啡", "奶茶", "小吃", "火锅", "烧烤", "肯德基", "麦当劳", "星巴克", "瑞幸"),
            "交通" to listOf("滴滴", "高德", "地铁", "公交", "出租", "加油", "停车", "火车", "机票", "航空", "12306"),
            "购物" to listOf("淘宝", "京东", "拼多多", "天猫", "超市", "商场", "购物"),
            "娱乐" to listOf("电影", "游戏", "KTV", "音乐", "视频", "会员", "充值"),
            "生活" to listOf("水电", "物业", "话费", "流量", "房租", "租金"),
            "医疗" to listOf("医院", "药店", "药品", "诊所"),
            "教育" to listOf("学费", "培训", "课程", "书本")
        )

        for ((category, keywords) in categoryMap) {
            if (keywords.any { description.contains(it) || content.contains(it) }) {
                return category
            }
        }
        return "其他消费"
    }
}
