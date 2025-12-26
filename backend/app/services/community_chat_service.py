from supabase import Client
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

async def get_messages(supabase: Client, group_name: str) -> List[Dict[str, Any]]:
    response = supabase.table("chat_messages") \
        .select("*") \
        .eq("group_name", group_name) \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute()
    return response.data or []

async def post_message(supabase: Client, group_name: str, username: str, message: str) -> Dict[str, Any]:
    new_message = {
        "group_name": group_name,
        "username": username,
        "message": message,
    }
    response = supabase.table("chat_messages").insert(new_message).execute()
    return response.data[0] if response.data else {}

async def delete_message(supabase: Client, message_id: int, user_id: str):
    # First, verify the user owns the message they are trying to delete.
    # This requires a 'user_id' column in the 'chat_messages' table.
    # Assuming 'user_id' is stored with each message.
    message_to_delete = supabase.table("chat_messages").select("user_id").eq("id", message_id).single().execute()
    if message_to_delete.data and message_to_delete.data.get("user_id") == user_id:
        supabase.table("chat_messages").delete().eq("id", message_id).execute()
        return True
    return False

async def upsert_presence(supabase: Client, username: str):
    if not username:
        return
    supabase.table("online_users").upsert({
        "username": username,
        "last_ping": datetime.utcnow().isoformat()
    }).execute()

async def get_online_users(supabase: Client, threshold_seconds: int = 30) -> List[str]:
    cutoff_time = datetime.utcnow() - timedelta(seconds=threshold_seconds)
    response = supabase.table("online_users").select("username").gte("last_ping", cutoff_time.isoformat()).execute()
    return [user['username'] for user in response.data] if response.data else []

async def set_typing_status(supabase: Client, username: str, group_name: str, is_typing: bool):
    if not username:
        return
    supabase.table("typing_status").upsert({
        "username": username,
        "group_name": group_name,
        "is_typing": is_typing,
        "updated_at": datetime.utcnow().isoformat()
    }).execute()

async def get_typing_users(supabase: Client, group_name: str, exclude_username: Optional[str] = None) -> List[str]:
    cutoff_time = datetime.utcnow() - timedelta(seconds=10)
    query = supabase.table("typing_status").select("username").eq("group_name", group_name).eq("is_typing", True).gte("updated_at", cutoff_time.isoformat())
    if exclude_username:
        query = query.neq("username", exclude_username)
    
    response = query.execute()
    return [user['username'] for user in response.data] if response.data else []
