package com.smartbookkeeper.app.data.dao

import androidx.lifecycle.LiveData
import androidx.room.*
import com.smartbookkeeper.app.data.entity.Transaction

@Dao
interface TransactionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(transaction: Transaction): Long

    @Update
    suspend fun update(transaction: Transaction)

    @Delete
    suspend fun delete(transaction: Transaction)

    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    fun getAllTransactions(): LiveData<List<Transaction>>

    @Query("SELECT * FROM transactions WHERE id = :id")
    suspend fun getTransactionById(id: Long): Transaction?

    @Query("SELECT * FROM transactions WHERE timestamp BETWEEN :startTime AND :endTime ORDER BY timestamp DESC")
    fun getTransactionsByDateRange(startTime: Long, endTime: Long): LiveData<List<Transaction>>

    @Query("SELECT SUM(amount) FROM transactions WHERE type = 'EXPENSE' AND timestamp BETWEEN :startTime AND :endTime")
    fun getTotalExpense(startTime: Long, endTime: Long): LiveData<Double?>

    @Query("SELECT SUM(amount) FROM transactions WHERE type = 'INCOME' AND timestamp BETWEEN :startTime AND :endTime")
    fun getTotalIncome(startTime: Long, endTime: Long): LiveData<Double?>

    @Query("SELECT category, SUM(amount) as total FROM transactions WHERE type = 'EXPENSE' AND timestamp BETWEEN :startTime AND :endTime GROUP BY category ORDER BY total DESC")
    fun getExpenseByCategory(startTime: Long, endTime: Long): LiveData<List<CategoryTotal>>

    @Query("SELECT * FROM transactions WHERE isAutoRecorded = 1 ORDER BY timestamp DESC")
    fun getAutoRecordedTransactions(): LiveData<List<Transaction>>
}

data class CategoryTotal(
    val category: String,
    val total: Double
)
