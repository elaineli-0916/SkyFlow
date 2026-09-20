export const CITIES = [
  {
    id: "hong-kong", name: "Hong Kong", label: "香港", number: "01", timezone: "Asia/Hong_Kong", country: "China",
    latitude: 22.2936, longitude: 114.1694, heading: 155, pitch: -32, range: 5500,
    landmark: "维多利亚港", subtitle: "潮汐之间，城市醒来。", region: "ASIA · VICTORIA HARBOUR",
    story: "让镜头沿维港缓缓下降。海面、山脊与高楼相遇，天空成为这座城市的另一条地平线。",
    photo: { id: "hong-kong-harbour", url: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?auto=format&fit=crop&w=1000&q=85", title: "香港 · 城市天际线", author: "Unsplash", source: "https://unsplash.com/s/photos/hong-kong" }
  },
  {
    id: "beijing", name: "Beijing", label: "北京", number: "02", timezone: "Asia/Shanghai", country: "China",
    latitude: 39.9163, longitude: 116.3972, heading: 5, pitch: -42, range: 3400,
    landmark: "故宫", subtitle: "在屋脊之上，读一片天空。", region: "ASIA · THE FORBIDDEN CITY",
    story: "从地球飞向北京的中轴线。红墙与层叠的屋顶展开，日光沿着古老的城市纹理缓慢移动。",
    photo: { id: "beijing-palace", url: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?auto=format&fit=crop&w=1000&q=85", title: "北京 · 城市记忆", author: "Unsplash", source: "https://unsplash.com/photos/H3tr01sfqGg" }
  },
  {
    id: "new-york", name: "New York", label: "纽约", number: "03", timezone: "America/New_York", country: "United States",
    latitude: 40.7128, longitude: -74.006, heading: 25, pitch: -32, range: 4800,
    landmark: "曼哈顿", subtitle: "日光落下，万千故事亮起。", region: "NORTH AMERICA · MANHATTAN",
    story: "越过大西洋，来到曼哈顿。镜头落在河流与街区之间，看光线如何穿过密集的城市天际线。",
    photo: { id: "new-york-skyline", url: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1000&q=85", title: "纽约 · 城市天际线", author: "Unsplash", source: "https://unsplash.com/s/photos/new-york" }
  }
];

export function getCity(id) { return CITIES.find((city) => city.id === id); }

export function cityLocation(city) {
  return { latitude: city.latitude, longitude: city.longitude, name: city.name, country: city.country, timezone: city.timezone, source: "city-preset" };
}
