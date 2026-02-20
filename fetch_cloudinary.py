import os
import json
import cloudinary
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET"),
    secure = True
)

def generate_library():
    resources = []
    cursor = None
    
    while True:
        response = cloudinary.api.resources(
            type = "upload",
            max_results = 500,
            next_cursor = cursor
        )
        
        resources.extend(response.get('resources', []))
        cursor = response.get('next_cursor')
        if not cursor:
            break

    library = []
    for res in resources:
        if res['resource_type'] == 'image':
            library.append({
                "url": f"https://res.cloudinary.com/dokygyvyz/image/upload/f_auto,q_auto,w_1600/{res['public_id']}.{res['format']}",
                "date": res['created_at'].split('T')[0]
            })

    library.sort(key=lambda x: x['date'], reverse=True)
    print(json.dumps(library, indent=4))

if __name__ == "__main__":
    generate_library()