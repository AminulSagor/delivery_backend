import json

with open('Invoice_Finance_API.postman_collection.json') as f:
    data = json.load(f)
    
print('=' * 70)
print('POSTMAN COLLECTION SUMMARY')
print('=' * 70)
print(f'Collection: {data["info"]["name"]}')
print(f'Base URL: {data["variable"][0]["key"]} = {data["variable"][0]["value"]}')
print()

endpoint_count = 0
for folder in data['item']:
    print(f'\n📁 {folder["name"]} ({len(folder["item"])} endpoints)')
    print('-' * 70)
    for req in folder['item']:
        method = req['request']['method']
        url = req['request']['url']['raw']
        endpoint_count += 1
        print(f'  {endpoint_count:2}. {method:6} {url}')

print()
print('=' * 70)
print(f'✓ Total Endpoints: {endpoint_count}')
print('✓ JSON Structure: VALID')
print('=' * 70)
