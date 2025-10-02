import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar 
} from 'recharts';
import { 
  Wallet, TrendingUp, TrendingDown, Upload, Plus, 
  CreditCard, Smartphone, Receipt, BarChart3, Trash2, X
} from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Color scheme for charts
const COLORS = {
  personal: '#10B981', // emerald-500
  official: '#3B82F6', // blue-500
  savings: '#F59E0B'   // amber-500
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_personal: 0,
    total_official: 0,
    total_savings: 0,
    total_expenses: 0,
    total_income: 0,
    net_balance: 0,
    monthly_personal: 0,
    monthly_official: 0,
    monthly_savings: 0
  });
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [officialBreakdown, setOfficialBreakdown] = useState([]);
  const [personalBreakdown, setPersonalBreakdown] = useState([]);
  const [savingsBreakdown, setSavingsBreakdown] = useState([]);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-based
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Get month names
  const getMonthNames = () => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get available years (current year and past years with transactions)
  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 5; year--) {
      years.push(year);
    }
    return years;
  };

  // Format selected month/year for display
  const getSelectedMonthYear = () => {
    const monthNames = getMonthNames();
    return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedYear]);

  const fetchDashboardData = async () => {
    try {
      const monthParam = `?month=${selectedMonth}&year=${selectedYear}`;
      const [statsRes, categoryRes, trendsRes, transactionsRes, officialRes, personalRes, savingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats${monthParam}`),
        axios.get(`${API}/analytics/category-distribution${monthParam}`),
        axios.get(`${API}/analytics/monthly-trends`),
        axios.get(`${API}/transactions?limit=10`),
        axios.get(`${API}/analytics/official-breakdown${monthParam}`),
        axios.get(`${API}/analytics/personal-breakdown${monthParam}`),
        axios.get(`${API}/analytics/savings-breakdown${monthParam}`)
      ]);

      setStats(statsRes.data);
      setCategoryData(categoryRes.data);
      setMonthlyTrends(trendsRes.data);
      setRecentTransactions(transactionsRes.data);
      setOfficialBreakdown(officialRes.data);
      setPersonalBreakdown(personalRes.data);
      setSavingsBreakdown(savingsRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', error);
    }
  };

  const handleDeleteTransaction = async (transactionId, merchantName) => {
    if (!window.confirm(`Are you sure you want to delete the transaction for ${merchantName}?`)) {
      return;
    }

    setDeletingTransactionId(transactionId);
    try {
      await axios.delete(`${API}/transactions/${transactionId}`);
      toast.success('Transaction deleted successfully!');
      // Refresh dashboard data
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete transaction');
      console.error('Delete transaction error:', error);
    } finally {
      setDeletingTransactionId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Month Selector */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Financial Dashboard</h2>
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="month-select" className="text-sm font-medium">Month:</Label>
            <Select 
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="w-32" id="month-select" data-testid="month-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthNames().map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="year-select" className="text-sm font-medium">Year:</Label>
            <Select 
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-24" id="year-select" data-testid="year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableYears().map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              setSelectedMonth(now.getMonth() + 1);
              setSelectedYear(now.getFullYear());
            }}
            data-testid="current-month-btn"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Current Month
          </Button>
        </div>
        
        <p className="text-gray-600">
          Viewing data for <span className="font-semibold text-blue-600">{getSelectedMonthYear()}</span>
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card data-testid="total-income-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{stats.total_income.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">{getSelectedMonthYear()}</p>
          </CardContent>
        </Card>

        <Card data-testid="total-expenses-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₹{stats.total_expenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">{getSelectedMonthYear()}</p>
          </CardContent>
        </Card>

        <Card data-testid="net-balance-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <TrendingUp className={`h-4 w-4 ${stats.net_balance >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{stats.net_balance.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Income - Expenses</p>
          </CardContent>
        </Card>

        <Card data-testid="personal-expenses-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personal</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₹{stats.monthly_personal.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">{getSelectedMonthYear()}</p>
          </CardContent>
        </Card>

        <Card data-testid="official-expenses-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Official</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">₹{stats.monthly_official.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">{getSelectedMonthYear()}</p>
          </CardContent>
        </Card>

        <Card data-testid="savings-expenses-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">₹{stats.monthly_savings.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">{getSelectedMonthYear()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Overall Pie Chart - Category Distribution */}
        <Card data-testid="category-pie-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Overall Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => percent > 8 ? `${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.category] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend for better control */}
            <div className="mt-2 space-y-1">
              {categoryData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: COLORS[item.category] || '#8884d8' }}
                  />
                  <span className="capitalize flex-1">{item.category}</span>
                  <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {categoryData.length === 0 && (
              <p className="text-center text-gray-500 py-8 text-sm">No expenses recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Official Expenses Donut Chart */}
        <Card data-testid="official-donut-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Official Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={officialBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => percent > 15 ? `${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={60}
                  innerRadius={35}
                  fill="#3B82F6"
                  dataKey="amount"
                >
                  {officialBreakdown.map((entry, index) => (
                    <Cell key={`official-${index}`} fill={`hsl(${210 + index * 30}, 70%, ${60 - index * 5}%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend for better control */}
            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
              {officialBreakdown.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: `hsl(${210 + index * 30}, 70%, ${60 - index * 5}%)` }}
                  />
                  <span className="truncate flex-1">{item.merchant}</span>
                  <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {officialBreakdown.length === 0 && (
              <p className="text-center text-gray-500 py-8 text-sm">No official expenses</p>
            )}
          </CardContent>
        </Card>

        {/* Personal Expenses Donut Chart */}
        <Card data-testid="personal-donut-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Personal Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={personalBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => percent > 15 ? `${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={60}
                  innerRadius={35}
                  fill="#10B981"
                  dataKey="amount"
                >
                  {personalBreakdown.map((entry, index) => (
                    <Cell key={`personal-${index}`} fill={`hsl(${160 + index * 25}, 70%, ${50 - index * 5}%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend for better control */}
            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
              {personalBreakdown.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: `hsl(${160 + index * 25}, 70%, ${50 - index * 5}%)` }}
                  />
                  <span className="truncate flex-1">{item.merchant}</span>
                  <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {personalBreakdown.length === 0 && (
              <p className="text-center text-gray-500 py-8 text-sm">No personal expenses</p>
            )}
          </CardContent>
        </Card>

        {/* Savings Expenses Donut Chart */}
        <Card data-testid="savings-donut-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              Savings & Investments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={savingsBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => percent > 15 ? `${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={60}
                  innerRadius={35}
                  fill="#F59E0B"
                  dataKey="amount"
                >
                  {savingsBreakdown.map((entry, index) => (
                    <Cell key={`savings-${index}`} fill={`hsl(${45 + index * 20}, 70%, ${55 - index * 5}%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend for better control */}
            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
              {savingsBreakdown.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: `hsl(${45 + index * 20}, 70%, ${55 - index * 5}%)` }}
                  />
                  <span className="truncate flex-1">{item.merchant}</span>
                  <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {savingsBreakdown.length === 0 && (
              <p className="text-center text-gray-500 py-8 text-sm">No savings/investments</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card data-testid="recent-transactions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    transaction.category === 'personal' ? 'bg-emerald-500' : 
                    transaction.category === 'official' ? 'bg-blue-500' : 
                    'bg-amber-500'
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{transaction.merchant || 'Unknown Merchant'}</p>
                    {transaction.description && (
                      <p className="text-xs text-gray-600 max-w-48 truncate" title={transaction.description}>
                        {transaction.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.transaction_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: new Date(transaction.transaction_date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`font-semibold ${transaction.transaction_type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                      {transaction.transaction_type === 'debit' ? '-' : '+'}₹{transaction.amount.toLocaleString()}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {transaction.category}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTransaction(transaction.id, transaction.merchant || 'Unknown Merchant')}
                    disabled={deletingTransactionId === transaction.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    data-testid={`delete-transaction-${transaction.id}`}
                  >
                    {deletingTransactionId === transaction.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SMSParser = () => {
  const [smsText, setSmsText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSingleSMSParse = async () => {
    if (!smsText.trim()) {
      toast.error('Please enter SMS text to parse');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/parse-sms`, { sms_text: smsText });
      toast.success('SMS parsed successfully!');
      setSmsText('');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSMSParse = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/parse-sms-bulk`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Successfully parsed ${response.data.parsed_count} SMS messages!`);
      if (response.data.failed_count > 0) {
        toast.warning(`${response.data.failed_count} SMS messages could not be parsed`);
      }
      setFile(null);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse SMS file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="sms-parser">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">SMS Transaction Parser</h2>
        <p className="text-gray-600">Parse GPay and PhonePe SMS messages automatically</p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single" data-testid="single-sms-tab">Single SMS</TabsTrigger>
          <TabsTrigger value="bulk" data-testid="bulk-sms-tab">Bulk Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Parse Single SMS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sms-text">Paste SMS Text</Label>
                <Textarea
                  id="sms-text"
                  data-testid="sms-text-input"
                  placeholder="Paste your GPay or PhonePe SMS here..."
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  rows={6}
                  className="mt-2"
                />
              </div>
              <Button 
                onClick={handleSingleSMSParse} 
                disabled={loading}
                className="w-full"
                data-testid="parse-single-sms-btn"
              >
                {loading ? 'Parsing...' : 'Parse SMS'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Bulk SMS Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sms-file">Upload SMS File (.txt or .csv)</Label>
                <Input
                  id="sms-file"
                  type="file"
                  accept=".txt,.csv"
                  data-testid="sms-file-input"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Each line should contain one SMS message
                </p>
              </div>
              <Button 
                onClick={handleBulkSMSParse} 
                disabled={loading || !file}
                className="w-full"
                data-testid="parse-bulk-sms-btn"
              >
                {loading ? 'Processing...' : 'Parse SMS File'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sample SMS Formats */}
      <Card>
        <CardHeader>
          <CardTitle>Sample SMS Formats & Auto-Categorization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-medium text-sm mb-1">Official (OL keyword):</p>
            <code className="text-xs bg-gray-100 p-2 rounded block">
              You paid ₹500 to Swiggy OL food delivery using Google Pay. UPI transaction ID 123456789 on 15-Sep-24.
            </code>
          </div>
          <div>
            <p className="font-medium text-sm mb-1">Personal (PL keyword):</p>
            <code className="text-xs bg-gray-100 p-2 rounded block">
              You have successfully paid Rs.250 to Netflix PL entertainment via PhonePe. Txn ID: PE12345 on 15-Sep-24.
            </code>
          </div>
          <div>
            <p className="font-medium text-sm mb-1">Savings (SV keyword):</p>
            <code className="text-xs bg-gray-100 p-2 rounded block">
              You paid ₹5000 to SBI SV Mutual Fund SIP using Google Pay. UPI transaction ID 111222333 on 17-Sep-24.
            </code>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Auto-Categorization:</strong> Add <code className="bg-white px-1 rounded">OL</code>, <code className="bg-white px-1 rounded">PL</code>, or <code className="bg-white px-1 rounded">SV</code> keywords in merchant/description for automatic categorization into Official, Personal, or Savings respectively.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ManualEntry = () => {
  const [formData, setFormData] = useState({
    amount: '',
    transaction_type: 'debit',
    category: 'personal',
    payment_method: 'manual',
    merchant: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/transactions`, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      
      // Store the transaction ID for undo functionality
      setLastTransactionId(response.data.id);
      
      toast.success('Transaction added successfully!');
      setFormData({
        amount: '',
        transaction_type: 'debit',
        category: 'personal',
        payment_method: 'manual',
        merchant: '',
        description: ''
      });
      
      // Don't navigate immediately, allow user to see undo option
    } catch (error) {
      toast.error('Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!lastTransactionId) {
      toast.error('No recent transaction to undo');
      return;
    }

    setUndoLoading(true);
    try {
      await axios.delete(`${API}/transactions/${lastTransactionId}`);
      toast.success('Transaction undone successfully!');
      setLastTransactionId(null);
    } catch (error) {
      toast.error('Failed to undo transaction');
    } finally {
      setUndoLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6" data-testid="manual-entry">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Add Transaction</h2>
        <p className="text-gray-600">Manually add a new transaction</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                data-testid="amount-input"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                required
              />
            </div>

            <div>
              <Label htmlFor="transaction-type">Transaction Type</Label>
              <Select 
                value={formData.transaction_type}
                onValueChange={(value) => setFormData({...formData, transaction_type: value})}
              >
                <SelectTrigger data-testid="transaction-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Expense (Debit)</SelectItem>
                  <SelectItem value="credit">Income (Credit)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category}
                onValueChange={(value) => setFormData({...formData, category: value})}
              >
                <SelectTrigger data-testid="category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="official">Official</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select 
                value={formData.payment_method}
                onValueChange={(value) => setFormData({...formData, payment_method: value})}
              >
                <SelectTrigger data-testid="payment-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="gpay">Google Pay</SelectItem>
                  <SelectItem value="phonepe">PhonePe</SelectItem>
                  <SelectItem value="upi">Other UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="merchant">Merchant/Payee</Label>
              <Input
                id="merchant"
                placeholder="e.g., Swiggy, Amazon, etc."
                data-testid="merchant-input"
                value={formData.merchant}
                onChange={(e) => setFormData({...formData, merchant: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description..."
                data-testid="description-input"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full"
              data-testid="add-transaction-btn"
            >
              {loading ? 'Adding...' : 'Add Transaction'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Undo Section */}
      {lastTransactionId && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-800">Transaction Added Successfully!</p>
                <p className="text-sm text-amber-600">Changed your mind? You can undo the last transaction.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/')}
                  data-testid="view-dashboard-btn"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  View Dashboard
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUndo}
                  disabled={undoLoading}
                  data-testid="undo-transaction-btn"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {undoLoading ? 'Undoing...' : 'Undo'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ManageTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API}/transactions?limit=50`);
      setTransactions(response.data);
    } catch (error) {
      toast.error('Failed to fetch transactions');
      console.error('Fetch transactions error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId, merchantName) => {
    if (!window.confirm(`Are you sure you want to delete the transaction for ${merchantName}?`)) {
      return;
    }

    setDeletingTransactionId(transactionId);
    try {
      await axios.delete(`${API}/transactions/${transactionId}`);
      toast.success('Transaction deleted successfully!');
      // Remove from local state
      setTransactions(transactions.filter(t => t.id !== transactionId));
    } catch (error) {
      toast.error('Failed to delete transaction');
      console.error('Delete transaction error:', error);
    } finally {
      setDeletingTransactionId(null);
    }
  };

  const handleClearAllTransactions = async () => {
    if (!window.confirm('Are you sure you want to delete ALL transactions? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/transactions/clear/all`);
      toast.success('All transactions cleared successfully!');
      setTransactions([]);
    } catch (error) {
      toast.error('Failed to clear all transactions');
      console.error('Clear all transactions error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="manage-transactions">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Manage Transactions</h2>
          <p className="text-gray-600">View, edit, and delete your transactions • All time data</p>
        </div>
        {transactions.length > 0 && (
          <Button 
            variant="destructive"
            onClick={handleClearAllTransactions}
            data-testid="clear-all-btn"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-gray-500 mb-6">Start by adding a transaction or parsing SMS messages.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </Link>
              <Link to="/parse">
                <Button variant="outline">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Parse SMS
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Transactions ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full ${
                      transaction.category === 'personal' ? 'bg-emerald-500' : 
                      transaction.category === 'official' ? 'bg-blue-500' : 
                      'bg-amber-500'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium">{transaction.merchant || 'Unknown Merchant'}</p>
                      {transaction.description && (
                        <p className="text-sm text-gray-700 mt-1 bg-gray-100 px-2 py-1 rounded text-wrap">
                          "{transaction.description}"
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {transaction.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {transaction.payment_method}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {new Date(transaction.transaction_date).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${transaction.transaction_type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                        {transaction.transaction_type === 'debit' ? '-' : '+'}₹{transaction.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(transaction.transaction_date).toLocaleDateString()}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTransaction(transaction.id, transaction.merchant || 'Unknown Merchant')}
                      disabled={deletingTransactionId === transaction.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      data-testid={`delete-transaction-${transaction.id}`}
                    >
                      {deletingTransactionId === transaction.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Navigation = () => {
  return (
    <nav className="bg-white shadow-sm border-b mb-8" data-testid="navigation">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <Wallet className="h-6 w-6" />
            FinFlow
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" data-testid="dashboard-nav-btn">
                Dashboard
              </Button>
            </Link>
            <Link to="/parse">
              <Button variant="ghost" size="sm" data-testid="parse-sms-nav-btn">
                Parse SMS
              </Button>
            </Link>
            <Link to="/add">
              <Button variant="ghost" size="sm" data-testid="add-transaction-nav-btn">
                Add Transaction
              </Button>
            </Link>
            <Link to="/manage">
              <Button variant="ghost" size="sm" data-testid="manage-transactions-nav-btn">
                Manage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BrowserRouter>
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/parse" element={<SMSParser />} />
            <Route path="/add" element={<ManualEntry />} />
            <Route path="/manage" element={<ManageTransactions />} />
          </Routes>
        </div>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;