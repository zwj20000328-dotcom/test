package com.smartbookkeeper.app.repository

import androidx.lifecycle.LiveData
import com.smartbookkeeper.app.data.AppDatabase
import com.smartbookkeeper.app.data.dao.CategoryTotal
import com.smartbookkeeper.app.data.entity.Transaction

class TransactionRepository(private val database: AppDatabase) {

    private val dao = database.transactionDao()

    val allTransactions: LiveData<List<Transaction>> = dao.getAllTransactions()

    suspend fun insert(transaction: Transaction): Long = dao.insert(transaction)

    suspend fun update(transaction: Transaction) = dao.update(transaction)

    suspend fun delete(transaction: Transaction) = dao.delete(transaction)

    suspend fun getById(id: Long): Transaction? = dao.getTransactionById(id)

    fun getByDateRange(startTime: Long, endTime: Long): LiveData<List<Transaction>> =
        dao.getTransactionsByDateRange(startTime, endTime)

    fun getTotalExpense(startTime: Long, endTime: Long): LiveData<Double?> =
        dao.getTotalExpense(startTime, endTime)

    fun getTotalIncome(startTime: Long, endTime: Long): LiveData<Double?> =
        dao.getTotalIncome(startTime, endTime)

    fun getExpenseByCategory(startTime: Long, endTime: Long): LiveData<List<CategoryTotal>> =
        dao.getExpenseByCategory(startTime, endTime)

    fun getAutoRecorded(): LiveData<List<Transaction>> = dao.getAutoRecordedTransactions()
}
