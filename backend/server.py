from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class TransactionType(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"

class CategoryType(str, Enum):
    PERSONAL = "personal"
    OFFICIAL = "official"
    SAVINGS = "savings"

class PaymentMethod(str, Enum):
    GPAY = "gpay"
    PHONEPE = "phonepe"
    MANUAL = "manual"
    UPI = "upi"

# Models
class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    transaction_type: TransactionType
    category: CategoryType
    payment_method: PaymentMethod
    merchant: Optional[str] = None
    description: Optional[str] = None
    transaction_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    upi_transaction_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    amount: float
    transaction_type: TransactionType
    category: CategoryType
    payment_method: PaymentMethod
    merchant: Optional[str] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None

class SMSParseRequest(BaseModel):
    sms_text: str

class DashboardStats(BaseModel):
    total_personal: float
    total_official: float
    total_savings: float
    total_expenses: float
    total_income: float
    net_balance: float
    selected_month: int
    selected_year: int

# SMS Parsing Logic
class SMSParser:
    
    @staticmethod
    def categorize_transaction(description: str, merchant: str = "") -> CategoryType:
        """Auto-categorize based on keywords in description/merchant"""
        text_to_analyze = f"{description} {merchant}".lower()
        
        # Savings keywords (highest priority)
        savings_keywords = [
            'sv', 'savings', 'investment', 'mutual fund', 'sip', 'fd', 'fixed deposit',
            'recurring deposit', 'rd', 'ppf', 'nps', 'elss', 'equity', 'bond',
            'insurance premium', 'life insurance', 'term insurance', 'lic'
        ]
        
        # Official keywords
        official_keywords = [
            'ol', 'office', 'work', 'meeting', 'conference', 'business', 
            'client', 'project', 'travel', 'hotel', 'flight', 'uber', 
            'ola', 'rapido', 'petrol', 'fuel', 'stationary', 'equipment'
        ]
        
        # Personal keywords  
        personal_keywords = [
            'pl', 'personal', 'food', 'restaurant', 'grocery', 'shopping',
            'medical', 'pharmacy', 'entertainment', 'movie', 'game', 
            'family', 'friend', 'gift', 'clothing', 'fitness', 'gym'
        ]
        
        # Check savings first (highest priority)
        for keyword in savings_keywords:
            if keyword in text_to_analyze:
                return CategoryType.SAVINGS
        
        # Check official
        for keyword in official_keywords:
            if keyword in text_to_analyze:
                return CategoryType.OFFICIAL
                
        # Check personal  
        for keyword in personal_keywords:
            if keyword in text_to_analyze:
                return CategoryType.PERSONAL
                
        # Default to personal if no keywords match
        return CategoryType.PERSONAL
    
    @staticmethod
    def parse_gpay_sms(sms_text: str) -> Optional[Dict]:
        """Parse GPay SMS format"""
        patterns = [
            # GPay sent money pattern
            r'You sent ₹([\d,]+\.?\d*) to (.+?) via Google Pay UPI ID: (.+?) on (.+?)\.',
            # GPay received money pattern  
            r'You received ₹([\d,]+\.?\d*) from (.+?) via Google Pay UPI ID: (.+?) on (.+?)\.',
            # GPay payment pattern
            r'You paid ₹([\d,]+\.?\d*) to (.+?) using Google Pay\. UPI transaction ID (.+?) on (.+?)\.',
            # Another GPay pattern
            r'₹([\d,]+\.?\d*) sent to (.+?) using Google Pay\. (.+?) on (.+?)\.'
        ]
        
        for i, pattern in enumerate(patterns):
            match = re.search(pattern, sms_text, re.IGNORECASE)
            if match:
                amount = float(match.group(1).replace(',', ''))
                merchant = match.group(2).strip()
                
                # Determine transaction type based on pattern
                transaction_type = TransactionType.CREDIT if i == 1 else TransactionType.DEBIT
                
                return {
                    'amount': amount,
                    'merchant': merchant,
                    'transaction_type': transaction_type,
                    'payment_method': PaymentMethod.GPAY,
                    'upi_transaction_id': match.group(3) if len(match.groups()) >= 3 else None,
                    'sms_text': sms_text
                }
        return None
    
    @staticmethod
    def parse_phonepe_sms(sms_text: str) -> Optional[Dict]:
        """Parse PhonePe SMS format"""
        patterns = [
            # PhonePe payment pattern
            r'You have successfully paid Rs\.([\d,]+\.?\d*) to (.+?) via PhonePe\. Txn ID: (.+?) on (.+?)\.',
            # PhonePe sent money pattern
            r'₹([\d,]+\.?\d*) sent to (.+?) via PhonePe\. Transaction ID (.+?) on (.+?)\.',
            # PhonePe received money pattern
            r'₹([\d,]+\.?\d*) received from (.+?) via PhonePe\. Transaction ID (.+?) on (.+?)\.'
        ]
        
        for i, pattern in enumerate(patterns):
            match = re.search(pattern, sms_text, re.IGNORECASE)
            if match:
                amount = float(match.group(1).replace(',', ''))
                merchant = match.group(2).strip()
                
                # Determine transaction type  
                transaction_type = TransactionType.CREDIT if 'received' in pattern else TransactionType.DEBIT
                
                return {
                    'amount': amount,
                    'merchant': merchant,
                    'transaction_type': transaction_type,
                    'payment_method': PaymentMethod.PHONEPE,
                    'upi_transaction_id': match.group(3) if len(match.groups()) >= 3 else None,
                    'sms_text': sms_text
                }
        return None
    
    @staticmethod
    def parse_sms(sms_text: str) -> Optional[Transaction]:
        """Main SMS parsing function"""
        # Try GPay first
        parsed = SMSParser.parse_gpay_sms(sms_text)
        if not parsed:
            # Try PhonePe
            parsed = SMSParser.parse_phonepe_sms(sms_text)
        
        if parsed:
            # Auto-categorize based on merchant and SMS content
            category = SMSParser.categorize_transaction(
                parsed.get('sms_text', ''), 
                parsed.get('merchant', '')
            )
            
            transaction = Transaction(
                amount=parsed['amount'],
                transaction_type=parsed['transaction_type'],
                category=category,
                payment_method=parsed['payment_method'],
                merchant=parsed.get('merchant'),
                description=parsed.get('sms_text'),
                upi_transaction_id=parsed.get('upi_transaction_id')
            )
            return transaction
        
        return None

# Helper function to prepare data for MongoDB
def prepare_for_mongo(data):
    if isinstance(data, dict):
        prepared = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                prepared[key] = value.isoformat()
            elif isinstance(value, Enum):
                prepared[key] = value.value
            else:
                prepared[key] = value
        return prepared
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        parsed = {}
        for key, value in item.items():
            if key in ['transaction_date', 'created_at'] and isinstance(value, str):
                parsed[key] = datetime.fromisoformat(value)
            else:
                parsed[key] = value
        return parsed
    return item

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Finance Management API"}

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate):
    """Create a new transaction manually"""
    transaction_dict = transaction_data.dict()
    if transaction_dict.get('transaction_date') is None:
        transaction_dict['transaction_date'] = datetime.now(timezone.utc)
    
    transaction = Transaction(**transaction_dict)
    transaction_mongo = prepare_for_mongo(transaction.dict())
    await db.transactions.insert_one(transaction_mongo)
    return transaction

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(limit: int = 100):
    """Get all transactions with optional limit"""
    transactions = await db.transactions.find().sort("created_at", -1).limit(limit).to_list(length=None)
    parsed_transactions = [parse_from_mongo(t) for t in transactions]
    return [Transaction(**t) for t in parsed_transactions]

@api_router.post("/parse-sms")
async def parse_sms(request: SMSParseRequest):
    """Parse SMS text and create transaction"""
    transaction = SMSParser.parse_sms(request.sms_text)
    
    if not transaction:
        raise HTTPException(status_code=400, detail="Unable to parse SMS text. Please check the format.")
    
    # Save to database
    transaction_mongo = prepare_for_mongo(transaction.dict())
    await db.transactions.insert_one(transaction_mongo)
    
    return {
        "success": True,
        "message": "SMS parsed successfully",
        "transaction": transaction
    }

@api_router.post("/parse-sms-bulk")
async def parse_sms_bulk(file: UploadFile = File(...)):
    """Parse multiple SMS from uploaded text file"""
    if not file.filename.endswith(('.txt', '.csv')):
        raise HTTPException(status_code=400, detail="Only .txt and .csv files are supported")
    
    content = await file.read()
    sms_text = content.decode('utf-8')
    
    # Split by lines and parse each SMS
    sms_lines = [line.strip() for line in sms_text.split('\n') if line.strip()]
    
    parsed_count = 0
    failed_count = 0
    transactions = []
    
    for sms_line in sms_lines:
        transaction = SMSParser.parse_sms(sms_line)
        if transaction:
            transaction_mongo = prepare_for_mongo(transaction.dict())
            await db.transactions.insert_one(transaction_mongo)
            transactions.append(transaction)
            parsed_count += 1
        else:
            failed_count += 1
    
    return {
        "success": True,
        "parsed_count": parsed_count,
        "failed_count": failed_count,
        "total_lines": len(sms_lines),
        "transactions": transactions
    }

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(month: int = None, year: int = None):
    """Get dashboard statistics for a specific month/year or current month"""
    
    # Default to current month if not specified
    now = datetime.now(timezone.utc)
    target_month = month if month is not None else now.month
    target_year = year if year is not None else now.year
    
    # Get month boundaries
    start_of_month = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    
    # Calculate end of month
    if target_month == 12:
        end_of_month = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_of_month = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Aggregate total by category (for the selected month only)
    pipeline_total = [
        {"$match": {
            "created_at": {
                "$gte": start_of_month.isoformat(),
                "$lt": end_of_month.isoformat()
            }
        }},
        {"$group": {
            "_id": "$category",
            "total_debit": {"$sum": {"$cond": [{"$eq": ["$transaction_type", "debit"]}, "$amount", 0]}},
            "total_credit": {"$sum": {"$cond": [{"$eq": ["$transaction_type", "credit"]}, "$amount", 0]}}
        }}
    ]
    
    # Aggregate monthly by category
    pipeline_monthly = [
        {"$match": {
            "created_at": {
                "$gte": start_of_month.isoformat(),
                "$lt": end_of_month.isoformat()
            }
        }},
        {"$group": {
            "_id": "$category", 
            "monthly_debit": {"$sum": {"$cond": [{"$eq": ["$transaction_type", "debit"]}, "$amount", 0]}}
        }}
    ]
    
    total_results = await db.transactions.aggregate(pipeline_total).to_list(length=None)
    monthly_results = await db.transactions.aggregate(pipeline_monthly).to_list(length=None)
    
    # Process results (all data is now for the selected month only)
    stats = {
        "total_personal": 0,
        "total_official": 0,
        "total_savings": 0,
        "total_expenses": 0,
        "total_income": 0,
        "net_balance": 0,
        "selected_month": target_month,
        "selected_year": target_year
    }
    
    # Both total_results and monthly_results now contain the same data (for selected month)
    for result in total_results:
        category = result["_id"]
        debit = result["total_debit"]
        credit = result["total_credit"]
        
        if category == "personal":
            stats["total_personal"] = debit
        elif category == "official":
            stats["total_official"] = debit
        elif category == "savings":
            stats["total_savings"] = debit
            
        stats["total_expenses"] += debit
        stats["total_income"] += credit
    
    # Calculate net balance (Income - Expenses for selected month)
    stats["net_balance"] = stats["total_income"] - stats["total_expenses"]
    
    return stats

@api_router.get("/analytics/category-distribution")
async def get_category_distribution(month: int = None, year: int = None):
    """Get expense distribution by category for pie chart"""
    
    # Build match criteria
    match_criteria = {"transaction_type": "debit"}
    
    if month is not None and year is not None:
        start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        match_criteria["created_at"] = {
            "$gte": start_of_month.isoformat(),
            "$lt": end_of_month.isoformat()
        }
    
    pipeline = [
        {"$match": match_criteria},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(length=None)
    return [{"category": result["_id"], "amount": result["total"]} for result in results]

@api_router.get("/analytics/monthly-trends")
async def get_monthly_trends():
    """Get monthly spending trends for line chart"""
    pipeline = [
        {"$match": {"transaction_type": "debit"}},
        {
            "$group": {
                "_id": {
                    "year": {"$year": {"$dateFromString": {"dateString": "$created_at"}}},
                    "month": {"$month": {"$dateFromString": {"dateString": "$created_at"}}},
                    "category": "$category"
                },
                "total": {"$sum": "$amount"}
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(length=None)
    return results

@api_router.get("/analytics/official-breakdown")
async def get_official_breakdown(month: int = None, year: int = None):
    """Get detailed breakdown of official expenses by merchant/type"""
    
    # Build match criteria
    match_criteria = {"transaction_type": "debit", "category": "official"}
    
    if month is not None and year is not None:
        start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        match_criteria["created_at"] = {
            "$gte": start_of_month.isoformat(),
            "$lt": end_of_month.isoformat()
        }
    
    pipeline = [
        {"$match": match_criteria},
        {"$group": {"_id": "$merchant", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(length=None)
    return [{"merchant": result["_id"] or "Unknown", "amount": result["total"]} for result in results]

@api_router.get("/analytics/personal-breakdown")
async def get_personal_breakdown(month: int = None, year: int = None):
    """Get detailed breakdown of personal expenses by merchant/type"""
    
    # Build match criteria
    match_criteria = {"transaction_type": "debit", "category": "personal"}
    
    if month is not None and year is not None:
        start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        match_criteria["created_at"] = {
            "$gte": start_of_month.isoformat(),
            "$lt": end_of_month.isoformat()
        }
    
    pipeline = [
        {"$match": match_criteria},
        {"$group": {"_id": "$merchant", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(length=None)
    return [{"merchant": result["_id"] or "Unknown", "amount": result["total"]} for result in results]

@api_router.get("/analytics/savings-breakdown")
async def get_savings_breakdown(month: int = None, year: int = None):
    """Get detailed breakdown of savings expenses by merchant/type"""
    
    # Build match criteria
    match_criteria = {"transaction_type": "debit", "category": "savings"}
    
    if month is not None and year is not None:
        start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        match_criteria["created_at"] = {
            "$gte": start_of_month.isoformat(),
            "$lt": end_of_month.isoformat()
        }
    
    pipeline = [
        {"$match": match_criteria},
        {"$group": {"_id": "$merchant", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(length=None)
    return [{"merchant": result["_id"] or "Unknown", "amount": result["total"]} for result in results]

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    """Delete a transaction"""
    result = await db.transactions.delete_one({"id": transaction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"success": True, "message": "Transaction deleted successfully"}

@api_router.delete("/transactions/clear/all")
async def clear_all_transactions():
    """Clear all transactions - fresh start"""
    result = await db.transactions.delete_many({})
    return {
        "success": True, 
        "message": f"Cleared {result.deleted_count} transactions successfully",
        "deleted_count": result.deleted_count
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()