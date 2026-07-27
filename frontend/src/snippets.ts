export const defaultSnippets: Record<string, string> = {
  javascript: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
`,

  typescript: `function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement)!, i];
    seen.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
`,

  python: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, n in enumerate(nums):
        complement = target - n
        if complement in seen:
            return [seen[complement], i]
        seen[n] = i
    return []

print(two_sum([2, 7, 11, 15], 9))  # [0, 1]
`,

  go: `package main

import "fmt"

func twoSum(nums []int, target int) []int {
\tseen := make(map[int]int)
\tfor i, n := range nums {
\t\tcomplement := target - n
\t\tif j, ok := seen[complement]; ok {
\t\t\treturn []int{j, i}
\t\t}
\t\tseen[n] = i
\t}
\treturn nil
}

func main() {
\tfmt.Println(twoSum([]int{2, 7, 11, 15}, 9)) // [0 1]
}
`,

  java: `import java.util.HashMap;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        HashMap<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[]{seen.get(complement), i};
            }
            seen.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        int[] result = s.twoSum(new int[]{2, 7, 11, 15}, 9);
        System.out.println(result[0] + ", " + result[1]); // 0, 1
    }
}
`,

  cpp: `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); i++) {
        int complement = target - nums[i];
        if (seen.count(complement)) return {seen[complement], i};
        seen[nums[i]] = i;
    }
    return {};
}

int main() {
    vector<int> nums = {2, 7, 11, 15};
    auto result = twoSum(nums, 9);
    cout << result[0] << ", " << result[1] << endl; // 0, 1
}
`,

  rust: `use std::collections::HashMap;

fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
    let mut seen: HashMap<i32, i32> = HashMap::new();
    for (i, &n) in nums.iter().enumerate() {
        let complement = target - n;
        if let Some(&j) = seen.get(&complement) {
            return vec![j, i as i32];
        }
        seen.insert(n, i as i32);
    }
    vec![]
}

fn main() {
    println!("{:?}", two_sum(vec![2, 7, 11, 15], 9)); // [0, 1]
}
`,

  sql: `-- Find users with more than 3 orders in the last 30 days
SELECT
    u.id,
    u.email,
    COUNT(o.id) AS order_count
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
HAVING COUNT(o.id) > 3
ORDER BY order_count DESC;
`,

  json: `{
  "name": "collab-editor",
  "version": "1.0.0",
  "description": "Real-time collaborative code editor",
  "stack": {
    "backend": "Go",
    "frontend": "React + TypeScript",
    "sync": "CRDTs (Logoot)",
    "transport": "WebSockets"
  },
  "features": [
    "conflict-free concurrent editing",
    "cursor presence",
    "JWT auth",
    "snapshot persistence"
  ]
}
`,

  markdown: `# Collab Editor

A real-time collaborative code editor powered by **CRDTs**.

## Features

- Conflict-free concurrent editing via Logoot CRDT
- Live cursor presence with per-user colors
- Syntax highlighting for 12+ languages
- Persistent sessions via PostgreSQL snapshots

## How it works

Each keystroke generates a CRDT operation with a unique fractional
position. Operations commute — applying them in any order produces
the same document. No central sequencer needed.
`,

  yaml: `# Docker Compose - Collab Editor
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - DB_URL=postgres://postgres:postgres@postgres:5432/collab
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "80:80"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: collab
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,

  bash: `#!/usr/bin/env bash
set -euo pipefail

# Deploy collab-editor to a remote server
HOST="\${1:?Usage: deploy.sh <host>}"
IMAGE="collab-editor"

echo "Building images..."
docker compose build --no-cache

echo "Pushing to \$HOST..."
docker save "\$IMAGE-backend" "\$IMAGE-frontend" | ssh "\$HOST" docker load

echo "Restarting services..."
ssh "\$HOST" "cd ~/collab-editor && docker compose up -d"

echo "Deploy complete."
`,
}
