import requests
import sys
import json
from datetime import datetime
import tempfile
import os

class FinanceAPITester:
    def __init__(self, base_url="https://finflow-285.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:300]
                })

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_create_manual_transaction(self):
        """Test manual transaction creation"""
        transaction_data = {
            "amount": 500.0,
            "transaction_type": "debit",
            "category": "personal",
            "payment_method": "manual",
            "merchant": "Test Merchant",
            "description": "Test transaction for API testing"
        }
        success, response = self.run_test(
            "Create Manual Transaction",
            "POST",
            "transactions",
            200,
            data=transaction_data
        )
        return success, response.get('id') if success else None

    def test_get_transactions(self):
        """Test getting all transactions"""
        return self.run_test("Get All Transactions", "GET", "transactions", 200)

    def test_parse_gpay_sms(self):
        """Test GPay SMS parsing"""
        gpay_sms = "You paid ₹500 to Swiggy using Google Pay. UPI transaction ID 123456789 on 15-Sep-24."
        sms_data = {"sms_text": gpay_sms}
        return self.run_test("Parse GPay SMS", "POST", "parse-sms", 200, data=sms_data)

    def test_parse_phonepe_sms(self):
        """Test PhonePe SMS parsing"""
        phonepe_sms = "You have successfully paid Rs.250 to Uber via PhonePe. Txn ID: PE12345 on 15-Sep-24."
        sms_data = {"sms_text": phonepe_sms}
        return self.run_test("Parse PhonePe SMS", "POST", "parse-sms", 200, data=sms_data)

    def test_parse_invalid_sms(self):
        """Test invalid SMS parsing (should fail)"""
        invalid_sms = "This is not a valid payment SMS message."
        sms_data = {"sms_text": invalid_sms}
        return self.run_test("Parse Invalid SMS", "POST", "parse-sms", 400, data=sms_data)

    def test_bulk_sms_upload(self):
        """Test bulk SMS file upload"""
        # Create a temporary file with sample SMS messages
        sms_content = """You paid ₹300 to Amazon using Google Pay. UPI transaction ID ABC123 on 15-Sep-24.
You have successfully paid Rs.150 to Zomato via PhonePe. Txn ID: PE67890 on 16-Sep-24.
₹200 sent to Flipkart using Google Pay. DEF456 on 17-Sep-24."""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(sms_content)
            temp_file_path = f.name

        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_sms.txt', f, 'text/plain')}
                success, response = self.run_test(
                    "Bulk SMS Upload",
                    "POST", 
                    "parse-sms-bulk",
                    200,
                    files=files
                )
            return success, response
        finally:
            os.unlink(temp_file_path)

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        return self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_category_distribution(self):
        """Test category distribution analytics"""
        return self.run_test("Category Distribution", "GET", "analytics/category-distribution", 200)

    def test_monthly_trends(self):
        """Test monthly trends analytics"""
        return self.run_test("Monthly Trends", "GET", "analytics/monthly-trends", 200)

    def test_delete_transaction(self, transaction_id):
        """Test transaction deletion"""
        if not transaction_id:
            print("⚠️  Skipping delete test - no transaction ID available")
            return False, {}
        return self.run_test(
            "Delete Transaction",
            "DELETE",
            f"transactions/{transaction_id}",
            200
        )

    def test_auto_categorization(self):
        """Test auto-categorization logic"""
        # Test official categorization
        official_sms = "You paid ₹1000 to OL Office Supplies using Google Pay. UPI transaction ID OFF123 on 15-Sep-24."
        official_data = {"sms_text": official_sms}
        success1, response1 = self.run_test("Auto-categorize Official", "POST", "parse-sms", 200, data=official_data)
        
        # Test personal categorization  
        personal_sms = "You paid ₹500 to PL Restaurant using Google Pay. UPI transaction ID PER123 on 15-Sep-24."
        personal_data = {"sms_text": personal_sms}
        success2, response2 = self.run_test("Auto-categorize Personal", "POST", "parse-sms", 200, data=personal_data)
        
        # Verify categorization
        if success1 and success2:
            official_category = response1.get('transaction', {}).get('category')
            personal_category = response2.get('transaction', {}).get('category')
            
            print(f"   Official SMS categorized as: {official_category}")
            print(f"   Personal SMS categorized as: {personal_category}")
            
            if official_category == 'official' and personal_category == 'personal':
                print("✅ Auto-categorization working correctly")
                return True
            else:
                print("❌ Auto-categorization not working as expected")
                return False
        
        return False

def main():
    print("🚀 Starting Finance Management API Tests")
    print("=" * 50)
    
    tester = FinanceAPITester()
    
    # Test sequence
    print("\n📋 Running API Tests...")
    
    # Basic API tests
    tester.test_root_endpoint()
    
    # Transaction CRUD tests
    success, transaction_id = tester.test_create_manual_transaction()
    tester.test_get_transactions()
    
    # SMS parsing tests
    tester.test_parse_gpay_sms()
    tester.test_parse_phonepe_sms()
    tester.test_parse_invalid_sms()
    tester.test_bulk_sms_upload()
    
    # Auto-categorization test
    tester.test_auto_categorization()
    
    # Analytics tests
    tester.test_dashboard_stats()
    tester.test_category_distribution()
    tester.test_monthly_trends()
    
    # Cleanup test (delete the created transaction)
    if transaction_id:
        tester.test_delete_transaction(transaction_id)
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failed in tester.failed_tests:
            print(f"   - {failed['name']}: {failed.get('error', f'Expected {failed.get(\"expected\")}, got {failed.get(\"actual\")}')}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())