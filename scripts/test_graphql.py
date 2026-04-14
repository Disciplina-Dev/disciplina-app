import requests
import json

GRAPHQL_URL = 'http://localhost:7080/api/graphql/companies'

def run_query(query: str, variables: dict = None):
    response = requests.post(
        GRAPHQL_URL,
        json={'query': query, 'variables': variables} if variables else {'query': query},
        headers={'Content-Type': 'application/json'}
    )
    print(f'Request: {query[:50]}...')
    print(f'Status: {response.status_code}')
    print(f'Response: {json.dumps(response.json(), indent=2)}\n')
    return response.json()

print('=' * 50)
print('TESTING GRAPHQL API')
print('=' * 50 + '\n')

# 1. Get all companies
print('1. Get all companies (companies)')
run_query('''
query {
  companies {
    id
    contactName
    commercial
    siret
  }
}
''')

# 2. Get companies by commercial
print('2. Get companies by commercial (companyByCommercial)')
run_query('''
query($commercial: String!) {
  companyByCommercial(commercial: $commercial) {
    id
    contactName
    commercial
  }
}
''', {'commercial': 'Emile'})

# 3. Get company by SIRET
print('3. Get company by SIRET (companyBySiret)')
run_query('''
query($siret: String!) {
  companyBySiret(siret: $siret) {
    id
    contactName
    siret
  }
}
''', {'siret': '83125883500014'})

# 4. Create a company
print('4. Create a company (createCompany)')
create_result = run_query('''
mutation($input: CompanyInput!) {
  createCompany(input: $input) {
    id
    contactName
    siret
  }
}
''', {
    'input': {
        'contactName': 'Test Company',
        'commercial': 'Test Commercial',
        'siret': '12345678901234'
    }
})

# Extract created ID for update/delete tests
try:
    created_id = create_result['data']['createCompany']['id']
    print(f'Created company ID: {created_id}\n')
except:
    created_id = None
    print('Could not extract created ID\n')

# 5. Update a company
if created_id:
    print('5. Update a company (updateCompany)')
    run_query('''
    mutation($id: Int!, $input: CompanyInput!) {
      updateCompany(id: $id, input: $input) {
        id
        contactName
        commercial
      }
    }
    ''', {
        'id': created_id,
        'input': {
            'contactName': 'Updated Company',
            'commercial': 'Updated Commercial'
        }
    })

# 6. Delete a company
if created_id:
    print('6. Delete a company (deleteCompany)')
    run_query('''
    mutation($id: Int!) {
      deleteCompany(id: $id)
    }
    ''', {'id': created_id})

print('=' * 50)
print('ALL TESTS COMPLETED')
print('=' * 50)