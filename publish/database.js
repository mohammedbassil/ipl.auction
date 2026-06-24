// IPL Mega Auction 2025 – Franchise & Player Database (350 Active Players)

const FRANCHISES = [
  { id: 0, name: "Chennai Super Kings",        short: "CSK",  color1: "#FFCC00", color2: "#0A1931" },
  { id: 1, name: "Mumbai Indians",             short: "MI",   color1: "#004BA0", color2: "#D4AF37" },
  { id: 2, name: "Royal Challengers Bengaluru",short: "RCB",  color1: "#CC0000", color2: "#000000" },
  { id: 3, name: "Kolkata Knight Riders",      short: "KKR",  color1: "#3A225D", color2: "#D4AF37" },
  { id: 4, name: "Delhi Capitals",             short: "DC",   color1: "#0078BC", color2: "#EF1C25" },
  { id: 5, name: "Rajasthan Royals",           short: "RR",   color1: "#E8548A", color2: "#254AA5" },
  { id: 6, name: "Punjab Kings",               short: "PBKS", color1: "#ED1B24", color2: "#C0C0C0" },
  { id: 7, name: "Sunrisers Hyderabad",        short: "SRH",  color1: "#FF7300", color2: "#000000" },
  { id: 8, name: "Lucknow Super Giants",       short: "LSG",  color1: "#A72B3F", color2: "#002D62" },
  { id: 9, name: "Gujarat Titans",             short: "GT",   color1: "#1C1C54", color2: "#C8A951" }
];

// IDs of uncapped players
const UNCAPPED_IDS = new Set([
  46, 47, 48, 80, 81, 83, 84, 85, 96,
  151, 155, 157, 158, 215, 217, 218, 219, 220,
  251, 252, 253, 254, 255, 256, 257, 258, 259, 260,
  301, 302, 303, 304, 305, 306, 307, 308, 309, 310,
  311, 312, 313, 314, 315, 316, 317, 318, 319, 320,
  321, 322, 323, 324, 325, 326, 327, 328, 329, 330
]);

// formerTeamId assignment (6-7 players per team for retention candidates)
// CSK=0, MI=1, RCB=2, KKR=3, DC=4, RR=5, PBKS=6, SRH=7, LSG=8, GT=9
const FORMER_TEAM_MAP = {
  // CSK (0)
  0: 0, 35: 0, 87: 0, 146: 0, 200: 0, 90: 0, 158: 0,
  // MI (1)
  27: 1, 31: 1, 86: 1, 141: 1, 44: 1, 116: 1, 107: 1,
  // RCB (2)
  26: 2, 53: 2, 56: 2, 114: 2, 50: 2, 155: 2, 177: 2,
  // KKR (3)
  30: 3, 101: 3, 105: 3, 92: 3, 161: 3, 3: 3, 221: 3,
  // DC (4)
  1: 4, 52: 4, 88: 4, 207: 4, 37: 4, 174: 4, 117: 4,
  // RR (5)
  2: 5, 32: 5, 11: 5, 168: 5, 45: 5, 100: 5, 14: 5,
  // PBKS (6)
  143: 6, 110: 6, 63: 6, 51: 6, 173: 6, 34: 6, 156: 6,
  // SRH (7)
  10: 7, 89: 7, 93: 7, 160: 7, 144: 7, 96: 7, 7: 7,
  // LSG (8)
  29: 8, 13: 8, 14: 8, 179: 8, 212: 8, 98: 8, 157: 8,
  // GT (9)
  28: 9, 55: 9, 221: 9, 142: 9, 33: 9, 223: 9, 154: 9,
};

function getFormerTeam(id) {
  if (FORMER_TEAM_MAP[id] !== undefined) return FORMER_TEAM_MAP[id];
  return (id - 1) % 10;
}

const RAW_PLAYERS_TEXT = `
1.  Rishabh Pant | India | WK-Batter | ₹2 Cr
2.  Sanju Samson | India | WK-Batter | ₹2 Cr
3.  Ishan Kishan | India | WK-Batter | ₹1 Cr
4.  Dhruv Jurel | India | WK-Batter | ₹50 L
5.  KS Bharat | India | WK-Batter | ₹30 L
6.  Dinesh Karthik | India | WK-Batter | ₹50 L
7.  Jitesh Sharma | India | WK-Batter | ₹50 L
8.  Anuj Rawat | India | WK-Batter | ₹30 L
9.  Upstham Chand | India | WK-Batter | ₹30 L
10. Heinrich Klaasen | South Africa | WK-Batter | ₹1.5 Cr
11. Jos Buttler | England | WK-Batter | ₹2 Cr
12. Jonny Bairstow | England | WK-Batter | ₹1.5 Cr
13. Quinton de Kock | South Africa | WK-Batter | ₹1.5 Cr
14. Nicholas Pooran | West Indies | WK-Batter | ₹1.5 Cr
15. Phil Salt | England | WK-Batter | ₹1 Cr
16. Alex Carey | Australia | WK-Batter | ₹75 L
17. Matthew Wade | Australia | WK-Batter | ₹50 L
18. Tom Latham | New Zealand | WK-Batter | ₹50 L
19. Devon Conway | New Zealand | WK-Batter | ₹1 Cr
20. Lorcan Tucker | Ireland | WK-Batter | ₹30 L
21. Niroshan Dickwella | Sri Lanka | WK-Batter | ₹30 L
22. Mushfiqur Rahim | Bangladesh | WK-Batter | ₹30 L
23. Litton Das | Bangladesh | WK-Batter | ₹30 L
24. Joshua Da Silva | West Indies | WK-Batter | ₹30 L
25. Ryan Rickelton | South Africa | WK-Batter | ₹50 L
26. Virat Kohli | India | Batter | ₹2 Cr
27. Rohit Sharma | India | Batter | ₹2 Cr
28. Shubman Gill | India | Batter | ₹2 Cr
29. KL Rahul | India | Batter | ₹2 Cr
30. Shreyas Iyer | India | Batter | ₹2 Cr
31. Suryakumar Yadav | India | Batter | ₹2 Cr
32. Yashasvi Jaiswal | India | Batter | ₹2 Cr
33. Sai Sudharsan | India | Batter | ₹1 Cr
34. Abhishek Sharma | India | Batter | ₹75 L
35. Ruturaj Gaikwad | India | Batter | ₹1.5 Cr
36. Devdutt Padikkal | India | Batter | ₹75 L
37. Prithvi Shaw | India | Batter | ₹50 L
38. Mayank Agarwal | India | Batter | ₹50 L
39. Manish Pandey | India | Batter | ₹50 L
40. Sarfaraz Khan | India | Batter | ₹75 L
41. Tilak Varma | India | Batter | ₹75 L
42. Riyan Parag | India | Batter | ₹50 L
43. Rajat Patidar | India | Batter | ₹75 L
44. Nitish Rana | India | Batter | ₹75 L
45. Rinku Singh | India | Batter | ₹50 L
46. Vaibhav Suryavanshi | India | Batter | ₹30 L
47. Musheer Khan | India | Batter | ₹30 L
48. Shaik Rasheed | India | Batter | ₹30 L
49. N Jagadeesan | India | Batter | ₹30 L
50. Prabhsimran Singh | India | Batter | ₹75 L
51. Rilee Rossouw | South Africa | Batter | ₹75 L
52. David Warner | Australia | Batter | ₹1 Cr
53. Faf du Plessis | South Africa | Batter | ₹1 Cr
54. Steve Smith | Australia | Batter | ₹1 Cr
55. David Miller | South Africa | Batter | ₹1 Cr
56. Glenn Maxwell | Australia | Batter | ₹2 Cr
57. Travis Head | Australia | Batter | ₹2 Cr
58. Kane Williamson | New Zealand | Batter | ₹1 Cr
59. Rachin Ravindra | New Zealand | Batter | ₹1 Cr
60. Finn Allen | New Zealand | Batter | ₹75 L
61. Dawid Malan | England | Batter | ₹75 L
62. Ben Duckett | England | Batter | ₹75 L
63. Liam Livingstone | England | Batter | ₹1 Cr
64. Sam Billings | England | Batter | ₹50 L
65. Babar Azam | Pakistan | Batter | ₹2 Cr
66. Mohammad Rizwan | Pakistan | WK-Batter | ₹1.5 Cr
67. Fakhar Zaman | Pakistan | Batter | ₹75 L
68. Evin Lewis | West Indies | Batter | ₹50 L
69. Brandon King | West Indies | Batter | ₹50 L
70. Kyle Mayers | West Indies | Batter | ₹75 L
71. Shimron Hetmyer | West Indies | Batter | ₹75 L
72. Pathum Nissanka | Sri Lanka | Batter | ₹75 L
73. Kusal Mendis | Sri Lanka | WK-Batter | ₹75 L
74. Aiden Markram | South Africa | Batter | ₹1 Cr
75. Reeza Hendricks | South Africa | Batter | ₹50 L
76. Rassie van der Dussen | South Africa | Batter | ₹75 L
77. Tony de Zorzi | South Africa | Batter | ₹50 L
78. Shai Hope | West Indies | WK-Batter | ₹50 L
79. Rahul Tripathi | India | Batter | ₹50 L
80. Tanmay Agarwal | India | Batter | ₹30 L
81. Atharva Taide | India | Batter | ₹30 L
82. B Indrajith | India | Batter | ₹30 L
83. Rohan Kadam | India | Batter | ₹30 L
84. Vivrant Sharma | India | Batter | ₹30 L
85. Himanshu Rana | India | Batter | ₹30 L
86. Hardik Pandya | India | All-Rounder | ₹2 Cr
87. Ravindra Jadeja | India | All-Rounder | ₹2 Cr
88. Axar Patel | India | All-Rounder | ₹1.5 Cr
89. Washington Sundar | India | All-Rounder | ₹75 L
90. Shivam Dube | India | All-Rounder | ₹75 L
91. Krunal Pandya | India | All-Rounder | ₹75 L
92. Venkatesh Iyer | India | All-Rounder | ₹1 Cr
93. Shahbaz Ahmed | India | All-Rounder | ₹50 L
94. Vijay Shankar | India | All-Rounder | ₹50 L
95. R Sai Kishore | India | All-Rounder | ₹50 L
96. Nitish Kumar Reddy | India | All-Rounder | ₹50 L
97. Deepak Hooda | India | All-Rounder | ₹50 L
98. Shashank Singh | India | All-Rounder | ₹50 L
99. Sherfane Rutherford | West Indies | All-Rounder | ₹50 L
100. Rovman Powell | West Indies | All-Rounder | ₹75 L
101. Andre Russell | West Indies | All-Rounder | ₹2 Cr
102. Jason Holder | West Indies | All-Rounder | ₹75 L
103. Romario Shepherd | West Indies | All-Rounder | ₹50 L
104. Carlos Brathwaite | West Indies | All-Rounder | ₹30 L
105. Sunil Narine | West Indies | All-Rounder | ₹2 Cr
106. Akeal Hosein | West Indies | All-Rounder | ₹30 L
107. Odean Smith | West Indies | All-Rounder | ₹30 L
108. Ben Stokes | England | All-Rounder | ₹2 Cr
109. Moeen Ali | England | All-Rounder | ₹75 L
110. Sam Curran | England | All-Rounder | ₹1 Cr
111. Chris Woakes | England | All-Rounder | ₹75 L
112. Chris Jordan | England | All-Rounder | ₹50 L
113. Tom Curran | England | All-Rounder | ₹30 L
114. Cameron Green | Australia | All-Rounder | ₹2 Cr
115. Marcus Stoinis | Australia | All-Rounder | ₹1 Cr
116. Tim David | Singapore | All-Rounder | ₹1 Cr
117. Mitchell Marsh | Australia | All-Rounder | ₹1.5 Cr
118. Sean Abbott | Australia | All-Rounder | ₹50 L
119. Matthew Short | Australia | All-Rounder | ₹50 L
120. Marnus Labuschagne | Australia | All-Rounder | ₹50 L
121. Wanindu Hasaranga | Sri Lanka | All-Rounder | ₹1 Cr
122. Dasun Shanaka | Sri Lanka | All-Rounder | ₹50 L
123. Dhananjaya de Silva | Sri Lanka | All-Rounder | ₹50 L
124. Shakib Al Hasan | Bangladesh | All-Rounder | ₹75 L
125. Mehidy Hasan Miraz | Bangladesh | All-Rounder | ₹50 L
126. Mohammad Nabi | Afghanistan | All-Rounder | ₹75 L
127. Gulbadin Naib | Afghanistan | All-Rounder | ₹30 L
128. Wiaan Mulder | South Africa | All-Rounder | ₹50 L
129. Andile Phehlukwayo | South Africa | All-Rounder | ₹30 L
130. Daryl Mitchell | New Zealand | All-Rounder | ₹75 L
131. Michael Bracewell | New Zealand | All-Rounder | ₹50 L
132. James Neesham | New Zealand | All-Rounder | ₹50 L
133. Imad Wasim | Pakistan | All-Rounder | ₹50 L
134. Shadab Khan | Pakistan | All-Rounder | ₹75 L
135. Faheem Ashraf | Pakistan | All-Rounder | ₹30 L
136. Sikandar Raza | Zimbabwe | All-Rounder | ₹50 L
137. Mark Chapman | New Zealand | Batter | ₹30 L
138. Tom Kohler-Cadmore | England | Batter | ₹30 L
139. Josh Inglis | Australia | WK-Batter | ₹50 L
140. Heinrich Klaasen | South Africa | WK-Batter | ₹1.5 Cr
141. Jasprit Bumrah | India | Fast Bowler | ₹2 Cr
142. Mohammed Shami | India | Fast Bowler | ₹2 Cr
143. Arshdeep Singh | India | Fast Bowler | ₹1.5 Cr
144. Bhuvneshwar Kumar | India | Fast Bowler | ₹75 L
145. T Natarajan | India | Fast Bowler | ₹50 L
146. Deepak Chahar | India | Fast Bowler | ₹75 L
147. Shardul Thakur | India | Fast Bowler | ₹75 L
148. Umesh Yadav | India | Fast Bowler | ₹50 L
149. Harshal Patel | India | Fast Bowler | ₹75 L
150. Navdeep Saini | India | Fast Bowler | ₹50 L
151. Simarjeet Singh | India | Fast Bowler | ₹30 L
152. Mukesh Kumar | India | Fast Bowler | ₹50 L
153. Avesh Khan | India | Fast Bowler | ₹50 L
154. Akash Deep | India | Fast Bowler | ₹50 L
155. Yash Dayal | India | Fast Bowler | ₹30 L
156. Prasidh Krishna | India | Fast Bowler | ₹75 L
157. Mohsin Khan | India | Fast Bowler | ₹30 L
158. Tushar Deshpande | India | Fast Bowler | ₹30 L
159. Khaleel Ahmed | India | Fast Bowler | ₹50 L
160. Umran Malik | India | Fast Bowler | ₹50 L
161. Pat Cummins | Australia | Fast Bowler | ₹2 Cr
162. Mitchell Starc | Australia | Fast Bowler | ₹2 Cr
163. Josh Hazlewood | Australia | Fast Bowler | ₹1.5 Cr
164. Nathan Ellis | Australia | Fast Bowler | ₹75 L
165. Spencer Johnson | Australia | Fast Bowler | ₹75 L
166. Daniel Sams | Australia | Fast Bowler | ₹50 L
167. Jason Behrendorff | Australia | Fast Bowler | ₹50 L
168. Trent Boult | New Zealand | Fast Bowler | ₹1.5 Cr
169. Tim Southee | New Zealand | Fast Bowler | ₹75 L
170. Lockie Ferguson | New Zealand | Fast Bowler | ₹1 Cr
171. Matt Henry | New Zealand | Fast Bowler | ₹75 L
172. Adam Milne | New Zealand | Fast Bowler | ₹50 L
173. Kagiso Rabada | South Africa | Fast Bowler | ₹1.5 Cr
174. Anrich Nortje | South Africa | Fast Bowler | ₹1.5 Cr
175. Lungi Ngidi | South Africa | Fast Bowler | ₹75 L
176. Ottneil Baartman | South Africa | Fast Bowler | ₹30 L
177. Gerald Coetzee | South Africa | Fast Bowler | ₹75 L
178. Nandre Burger | South Africa | Fast Bowler | ₹50 L
179. Mark Wood | England | Fast Bowler | ₹1.5 Cr
180. Jofra Archer | England | Fast Bowler | ₹2 Cr
181. Olly Stone | England | Fast Bowler | ₹50 L
182. Brydon Carse | England | Fast Bowler | ₹50 L
183. Reece Topley | England | Fast Bowler | ₹50 L
184. Richard Gleeson | England | Fast Bowler | ₹30 L
185. Oshane Thomas | West Indies | Fast Bowler | ₹50 L
186. Alzarri Joseph | West Indies | Fast Bowler | ₹75 L
187. Jayden Seales | West Indies | Fast Bowler | ₹30 L
188. Jayden Seales | West Indies | Fast Bowler | ₹30 L
189. Mustafizur Rahman | Bangladesh | Fast Bowler | ₹75 L
190. Shoriful Islam | Bangladesh | Fast Bowler | ₹30 L
191. Taskin Ahmed | Bangladesh | Fast Bowler | ₹50 L
192. Naveen-ul-Haq | Afghanistan | Fast Bowler | ₹75 L
193. Fazalhaq Farooqi | Afghanistan | Fast Bowler | ₹75 L
194. Haris Rauf | Pakistan | Fast Bowler | ₹1 Cr
195. Naseem Shah | Pakistan | Fast Bowler | ₹1 Cr
196. Shaheen Afridi | Pakistan | Fast Bowler | ₹1.5 Cr
197. Mohammad Wasim Jr | Pakistan | Fast Bowler | ₹50 L
198. Dushmantha Chameera | Sri Lanka | Fast Bowler | ₹50 L
199. Matheesha Pathirana | Sri Lanka | Fast Bowler | ₹1 Cr
200. Dilshan Madushanka | Sri Lanka | Fast Bowler | ₹50 L
201. Nuwan Thushara | Sri Lanka | Fast Bowler | ₹30 L
202. Blessing Muzarabani | Zimbabwe | Fast Bowler | ₹50 L
203. Paul van Meekeren | Netherlands | Fast Bowler | ₹30 L
204. Mohit Sharma | India | Fast Bowler | ₹50 L
205. Jaydev Unadkat | India | Fast Bowler | ₹50 L
206. Yuzvendra Chahal | India | Spin Bowler | ₹1 Cr
207. Kuldeep Yadav | India | Spin Bowler | ₹1 Cr
208. Ravichandran Ashwin | India | Spin Bowler | ₹1 Cr
209. Rahul Chahar | India | Spin Bowler | ₹50 L
210. Ravi Bishnoi | India | Spin Bowler | ₹75 L
211. Karn Sharma | India | Spin Bowler | ₹30 L
212. Varun Chakaravarthy | India | Spin Bowler | ₹75 L
213. Saurabh Kumar | India | Spin Bowler | ₹30 L
214. Shreyas Gopal | India | Spin Bowler | ₹30 L
215. Mayank Markande | India | Spin Bowler | ₹30 L
216. Piyush Chawla | India | Spin Bowler | ₹30 L
217. Shubhang Hegde | India | Spin Bowler | ₹30 L
218. Naman Dhir | India | Spin Bowler | ₹30 L
219. Vicky Ostwal | India | Spin Bowler | ₹30 L
220. Tanveer Sangha | India | Spin Bowler | ₹30 L
221. Rashid Khan | Afghanistan | Spin Bowler | ₹2 Cr
222. Mujeeb Ur Rahman | Afghanistan | Spin Bowler | ₹1 Cr
223. Noor Ahmad | Afghanistan | Spin Bowler | ₹75 L
224. Qais Ahmad | Afghanistan | Spin Bowler | ₹50 L
225. Zahir Khan | Afghanistan | Spin Bowler | ₹30 L
226. Tabraiz Shamsi | South Africa | Spin Bowler | ₹75 L
227. Keshav Maharaj | South Africa | Spin Bowler | ₹50 L
228. Adil Rashid | England | Spin Bowler | ₹75 L
229. Matt Parkinson | England | Spin Bowler | ₹30 L
230. Rehan Ahmed | England | Spin Bowler | ₹50 L
231. Mitchell Santner | New Zealand | Spin Bowler | ₹75 L
232. Ish Sodhi | New Zealand | Spin Bowler | ₹50 L
233. Adam Zampa | Australia | Spin Bowler | ₹75 L
234. Ashton Agar | Australia | Spin Bowler | ₹50 L
235. Maheesh Theekshana | Sri Lanka | Spin Bowler | ₹75 L
236. Jeffrey Vandersay | Sri Lanka | Spin Bowler | ₹30 L
237. Dunith Wellalage | Sri Lanka | Spin Bowler | ₹50 L
238. Nasum Ahmed | Bangladesh | Spin Bowler | ₹30 L
239. Taijul Islam | Bangladesh | Spin Bowler | ₹30 L
240. Abrar Ahmed | Pakistan | Spin Bowler | ₹50 L
241. Usama Mir | Pakistan | Spin Bowler | ₹30 L
242. Hayden Walsh Jr | West Indies | Spin Bowler | ₹30 L
243. Gudakesh Motie | West Indies | Spin Bowler | ₹30 L
244. Tom Kohler-Cadmore | England | Batter | ₹30 L
245. Harpreet Brar | India | All-Rounder | ₹30 L
246. Anmolpreet Singh | India | Batter | ₹30 L
247. Wriddhiman Saha | India | WK-Batter | ₹30 L
248. Naman Ojha | India | WK-Batter | ₹30 L
249. Rishi Dhawan | India | All-Rounder | ₹30 L
250. Krishnappa Gowtham | India | All-Rounder | ₹30 L
251. Aryan Juyal | India | WK-Batter | ₹30 L
252. Nikin Jose | India | Batter | ₹30 L
253. Abhinav Manohar | India | Batter | ₹30 L
254. Ankush Bains | India | Batter | ₹30 L
255. Gurnoor Brar | India | Fast Bowler | ₹30 L
256. Vidwath Kaverappa | India | Fast Bowler | ₹30 L
257. Vyshak Vijaykumar | India | Fast Bowler | ₹30 L
258. Rasikh Salam | India | Fast Bowler | ₹30 L
259. Anshul Kamboj | India | Fast Bowler | ₹30 L
260. Akash Singh | India | Fast Bowler | ₹30 L
261. Rahmanullah Gurbaz | Afghanistan | WK-Batter | ₹75 L
262. Ibrahim Zadran | Afghanistan | Batter | ₹50 L
263. Azmatullah Omarzai | Afghanistan | All-Rounder | ₹50 L
264. Matthew Short | Australia | All-Rounder | ₹50 L
265. Josh Philippe | Australia | WK-Batter | ₹50 L
266. Cameron Bancroft | Australia | Batter | ₹30 L
267. Tristan Stubbs | South Africa | Batter | ₹75 L
268. Dewald Brevis | South Africa | Batter | ₹75 L
269. Marco Jansen | South Africa | All-Rounder | ₹75 L
270. Evan Jones | South Africa | WK-Batter | ₹30 L
271. Charith Asalanka | Sri Lanka | Batter | ₹50 L
272. Bhanuka Rajapaksa | Sri Lanka | Batter | ₹50 L
273. Akila Dananjaya | Sri Lanka | Spin Bowler | ₹30 L
274. Chamika Karunaratne | Sri Lanka | All-Rounder | ₹30 L
275. Lahiru Kumara | Sri Lanka | Fast Bowler | ₹30 L
276. Towhid Hridoy | Bangladesh | Batter | ₹50 L
277. Tanzid Hasan | Bangladesh | Batter | ₹30 L
278. Parvez Hossain Emon | Bangladesh | Batter | ₹30 L
279. Tom Latham | New Zealand | WK-Batter | ₹50 L
280. Mark Wood | England | Fast Bowler | ₹1.5 Cr
281. Liam Dawson | England | All-Rounder | ₹30 L
282. Luke Wood | England | Fast Bowler | ₹30 L
283. Will Jacks | England | All-Rounder | ₹75 L
284. Jordan Cox | England | WK-Batter | ₹30 L
285. Jake Fraser-McGurk | Australia | Batter | ₹75 L
286. Sam Konstas | Australia | Batter | ₹50 L
287. Tim Seifert | New Zealand | WK-Batter | ₹30 L
288. Glenn Phillips | New Zealand | All-Rounder | ₹75 L
289. Cole McConchie | New Zealand | All-Rounder | ₹30 L
290. Seamus Lynch | Ireland | All-Rounder | ₹30 L
291. Paul Stirling | Ireland | Batter | ₹30 L
292. Azam Khan | Pakistan | WK-Batter | ₹30 L
293. Usman Khan | Pakistan | Batter | ₹30 L
294. Saim Ayub | Pakistan | Batter | ₹75 L
295. Mohammad Abbas | Pakistan | Fast Bowler | ₹30 L
296. Ihsanullah | Pakistan | Fast Bowler | ₹50 L
297. Tayyab Tahir | Pakistan | Batter | ₹30 L
298. Johnathan Campbell | West Indies | Batter | ₹30 L
299. Alick Athanaze | West Indies | Batter | ₹50 L
300. Roston Chase | West Indies | All-Rounder | ₹50 L
301. Dhruv Shorey | India | Batter | ₹30 L
302. Anuj Singh | India | Fast Bowler | ₹30 L
303. Hrithik Shokeen | India | All-Rounder | ₹30 L
304. Mohit Avasthi | India | Fast Bowler | ₹30 L
305. Nishant Sindhu | India | All-Rounder | ₹30 L
306. Shaswat Rawat | India | Batter | ₹30 L
307. Vansh Bedi | India | Fast Bowler | ₹30 L
308. Raj Bawa | India | All-Rounder | ₹30 L
309. Suyash Prabhudessai | India | Batter | ₹30 L
310. Sai Kishore | India | Spin Bowler | ₹30 L
311. Biplab Samantray | India | Batter | ₹30 L
312. Shahbaz Khan | India | Spin Bowler | ₹30 L
313. Arpit Vasavada | India | Batter | ₹30 L
314. Yuvraj Singh | India | Batter | ₹30 L
315. Nandre Burger | South Africa | Fast Bowler | ₹50 L
316. Kwena Maphaka | South Africa | Fast Bowler | ₹30 L
317. Donovan Ferreira | South Africa | All-Rounder | ₹30 L
318. Reece Pienaar | South Africa | All-Rounder | ₹30 L
319. Wihan Lubbe | South Africa | Batter | ₹30 L
320. Zak Crawley | England | Batter | ₹30 L
321. Akash Madhwal | India | Fast Bowler | ₹30 L
322. Ishan Porel | India | Fast Bowler | ₹30 L
323. Karan Sharma | India | Spin Bowler | ₹30 L
324. Rajvardhan Hangargekar | India | All-Rounder | ₹30 L
325. Swapnil Singh | India | Spin Bowler | ₹30 L
326. Darshan Nalkande | India | Fast Bowler | ₹30 L
327. Digvijay Deshmukh | India | Fast Bowler | ₹30 L
328. Ravisrinivasan Sai Kishore | India | Spin Bowler | ₹30 L
329. Prerak Mankad | India | All-Rounder | ₹30 L
330. Baba Aparajith | India | All-Rounder | ₹30 L
331. Ajay Mandal | India | All-Rounder | ₹30 L
332. Upendra Yadav | India | WK-Batter | ₹30 L
333. Rohit Paudel | Nepal | Batter | ₹30 L
334. Kushal Malla | Nepal | Batter | ₹30 L
335. Sandeep Lamichhane | Nepal | Spin Bowler | ₹30 L
336. Tobias Visee | Netherlands | Batter | ₹30 L
337. Bas de Leede | Netherlands | All-Rounder | ₹30 L
338. Logan van Beek | Netherlands | All-Rounder | ₹30 L
339. Ryan Burl | Zimbabwe | All-Rounder | ₹30 L
340. Sikandar Raza | Zimbabwe | All-Rounder | ₹50 L
341. Sean Williams | Zimbabwe | All-Rounder | ₹30 L
342. Gerhard Erasmus | Namibia | All-Rounder | ₹30 L
343. Nick Knight | England | Batter | ₹30 L
344. Devon Thomas | West Indies | WK-Batter | ₹30 L
345. Kjorn Ottley | West Indies | Batter | ₹30 L
346. Nkrumah Bonner | West Indies | Batter | ₹30 L
347. Jewel Andrew | West Indies | Batter | ₹30 L
348. Rahkeem Cornwall | West Indies | All-Rounder | ₹30 L
349. Anderson Phillip | West Indies | Fast Bowler | ₹30 L
350. Romario Shepherd | West Indies | All-Rounder | ₹50 L
`;

function parseBasePrice(priceStr) {
  const clean = priceStr.trim().replace('₹', '');
  if (clean.includes('Cr')) {
    const val = parseFloat(clean.replace('Cr', '').trim());
    return Math.round(val * 100);
  } else if (clean.includes('L')) {
    const val = parseFloat(clean.replace('L', '').trim());
    return Math.round(val);
  }
  return 30;
}

const PLAYERS = RAW_PLAYERS_TEXT.trim().split('\n')
  .filter(line => line.trim().length > 0)
  .map(line => {
    const parts = line.split('|');
    if (parts.length < 4) return null;
    const idNamePart = parts[0].trim();
    const firstDotIdx = idNamePart.indexOf('.');
    if (firstDotIdx === -1) return null;
    const id = parseInt(idNamePart.substring(0, firstDotIdx).trim());
    const name = idNamePart.substring(firstDotIdx + 1).trim();
    const country = parts[1].trim();
    const role = parts[2].trim();
    const priceStr = parts[3].trim();
    const basePriceLakhs = parseBasePrice(priceStr);
    const isUncapped = UNCAPPED_IDS.has(id);
    const isOverseas = country.toLowerCase() !== 'india';
    const formerTeamId = getFormerTeam(id);
    return {
      id, name, country, role, basePriceLakhs,
      isUncapped, isOverseas, formerTeamId,
      status: 'available',
      soldPriceLakhs: 0,
      boughtBy: null,
      isRtm: false
    };
  }).filter(p => p !== null);

// Helper functions
function formatPurse(lakhs) {
  const cr = lakhs / 100;
  return `₹${cr.toFixed(2)} Cr`;
}

function formatLakhs(lakhs) {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs} L`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FRANCHISES, PLAYERS, formatPurse, formatLakhs, getFormerTeam };
}
