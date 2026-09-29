/*
 * ISM DATA TECHNOLOGY ASSESSMENT - question bank
 *
 * 50 questions: 20 EASY + 30 HARD.
 * Fields: id, difficulty, question, code (optional), options[4], answer (0-based index).
 *
 * `answer` NEVER leaves the server - server.js strips it before sending to the browser.
 *
 * Every "predict the output" answer below was traced by hand; the trace is kept in a
 * comment next to the question. Where a construct is genuinely undefined in the language
 * standard, "Undefined behaviour / compiler dependent" is offered and is the correct answer.
 */

const questions = [
  /* ------------------------------------------------------------------ *
   *  EASY (20)                                                          *
   * ------------------------------------------------------------------ */
  {
    id: 1,
    difficulty: 'easy',
    question:
      'Which OOP principle is best described as bundling data together with the methods that operate on that data, while restricting direct access to some of the object\u2019s internals?',
    options: ['Inheritance', 'Encapsulation', 'Polymorphism', 'Overloading'],
    answer: 1
  },
  {
    id: 2,
    difficulty: 'easy',
    question: 'Which data structure follows the LIFO (Last In, First Out) principle?',
    options: ['Queue', 'Stack', 'Linked list', 'Binary heap'],
    answer: 1
  },
  {
    id: 3,
    difficulty: 'easy',
    question:
      'What is the worst-case time complexity of binary search on a sorted array of n elements?',
    options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(1)'],
    answer: 2
  },
  {
    id: 4,
    difficulty: 'easy',
    question:
      'In SQL, which clause is used to filter groups AFTER aggregation has been performed?',
    options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'],
    answer: 1
  },
  {
    id: 5,
    difficulty: 'easy',
    question: 'Which statement about a PRIMARY KEY in a relational database is TRUE?',
    options: [
      'It may contain NULL values',
      'It cannot contain NULL values and must be unique',
      'It may repeat as long as it is not NULL',
      'A table may have many primary keys'
    ],
    answer: 1
  },
  {
    id: 6,
    difficulty: 'easy',
    question: 'Which of the following is NOT a valid state of a process in an operating system?',
    options: ['Ready', 'Running', 'Compiled', 'Waiting'],
    answer: 2
  },
  {
    id: 7,
    difficulty: 'easy',
    question: 'The IP protocol operates at which layer of the OSI model?',
    options: ['Transport layer', 'Data link layer', 'Network layer', 'Session layer'],
    answer: 2
  },
  {
    id: 8,
    difficulty: 'easy',
    question: 'Which statement correctly distinguishes TCP from UDP?',
    options: [
      'TCP is connectionless, UDP is connection-oriented',
      'TCP is connection-oriented and reliable, UDP is connectionless and unreliable',
      'Both are connection-oriented, but UDP is faster',
      'TCP does not guarantee ordering, UDP does'
    ],
    answer: 1
  },
  {
    id: 9,
    difficulty: 'easy',
    question: 'What is the default port number used by HTTPS?',
    options: ['80', '21', '443', '8080'],
    answer: 2
  },
  {
    id: 10,
    difficulty: 'easy',
    question: 'What is printed by this Java statement?',
    code: 'System.out.println(3 + 4 + "7" + 3 + 4);',
    // 3+4 = 7 (int), then string concatenation takes over: "7" + "7" + "3" + "4"
    options: ['7734', '3473 4', '34734', '14'],
    answer: 0
  },
  {
    id: 11,
    difficulty: 'easy',
    question: 'What is the output of this C program fragment?',
    code: 'int i = 5;\nprintf("%d", i++);',
    // post-increment yields the old value, 5
    options: ['5', '6', '4', 'Compilation error'],
    answer: 0
  },
  {
    id: 12,
    difficulty: 'easy',
    question: 'What does this Python statement print?',
    code: 'print(2 ** 3 ** 2)',
    // ** is right-associative: 2 ** (3 ** 2) = 2 ** 9 = 512
    options: ['64', '512', '128', '36'],
    answer: 1
  },
  {
    id: 13,
    difficulty: 'easy',
    question: 'What is the output of this C statement?',
    code: 'printf("%d %d", 7 / 2, 7 % 2);',
    options: ['3.5 1', '3 1', '3 0', '4 1'],
    answer: 1
  },
  {
    id: 14,
    difficulty: 'easy',
    question:
      'Which traversal of a Binary Search Tree visits the keys in ascending sorted order?',
    options: ['Preorder', 'Postorder', 'Inorder', 'Level order'],
    answer: 2
  },
  {
    id: 15,
    difficulty: 'easy',
    question: 'What is the worst-case time complexity of bubble sort?',
    options: ['O(n)', 'O(n log n)', 'O(n\u00b2)', 'O(log n)'],
    answer: 2
  },
  {
    id: 16,
    difficulty: 'easy',
    question:
      'Which data structure offers O(1) average-case time for search, insert and delete by key?',
    options: ['Sorted array', 'Hash table', 'Singly linked list', 'Binary search tree'],
    answer: 1
  },
  {
    id: 17,
    difficulty: 'easy',
    question: 'Which Java keyword is used to inherit from a class?',
    options: ['implements', 'inherits', 'extends', 'super'],
    answer: 2
  },
  {
    id: 18,
    difficulty: 'easy',
    question: 'Which of the following is NOT an access modifier in Java?',
    options: ['public', 'protected', 'internal', 'private'],
    answer: 2
  },
  {
    id: 19,
    difficulty: 'easy',
    question: 'Breadth First Search (BFS) of a graph is implemented using which data structure?',
    options: ['Stack', 'Queue', 'Priority queue', 'Hash map'],
    answer: 1
  },
  {
    id: 20,
    difficulty: 'easy',
    question: 'A relation is in First Normal Form (1NF) when which condition is satisfied?',
    options: [
      'Every attribute contains only atomic (indivisible) values',
      'There are no transitive dependencies',
      'There are no partial dependencies on a composite key',
      'Every determinant is a candidate key'
    ],
    answer: 0
  },

  /* ------------------------------------------------------------------ *
   *  HARD (30)                                                          *
   * ------------------------------------------------------------------ */
  {
    id: 21,
    difficulty: 'hard',
    question:
      'What does this Java program print? (Java defines a strict left-to-right evaluation order for operands.)',
    code: 'int i = 5;\ni = i++ + ++i;\nSystem.out.println(i);',
    // i++ yields 5 and leaves i = 6; ++i makes i = 7 and yields 7; 5 + 7 = 12; i = 12
    options: ['10', '12', '11', '13'],
    answer: 1
  },
  {
    id: 22,
    difficulty: 'hard',
    question:
      'What does this C program print? Choose the most accurate answer according to the C standard.',
    code: 'int i = 5;\ni = i++ + ++i;\nprintf("%d", i);',
    // i is modified more than once between sequence points -> undefined behaviour in C
    options: ['12', '13', 'Undefined behaviour / compiler dependent', '11'],
    answer: 2
  },
  {
    id: 23,
    difficulty: 'hard',
    question: 'What is the output of this C program fragment?',
    code: 'int i = 0, count = 0;\nwhile (i++ < 5) {\n    count += i;\n}\nprintf("%d %d", i, count);',
    // test 0<5 -> i=1, count=1; 1<5 -> i=2, count=3; 2<5 -> i=3, count=6;
    // 3<5 -> i=4, count=10; 4<5 -> i=5, count=15; 5<5 false and i becomes 6
    options: ['5 15', '6 15', '6 21', '5 10'],
    answer: 1
  },
  {
    id: 24,
    difficulty: 'hard',
    question: 'What is the output of this C program fragment?',
    code: 'int i = 0, sum = 0;\ndo {\n    sum += i;\n} while (++i < 4);\nprintf("%d %d", i, sum);',
    // sum += 0; ++i=1<4 -> sum=1; ++i=2<4 -> sum=3; ++i=3<4 -> sum=6; ++i=4, 4<4 false
    options: ['4 6', '3 6', '4 10', '3 3'],
    answer: 0
  },
  {
    id: 25,
    difficulty: 'hard',
    question:
      'What is the output of this C program fragment? Pay close attention to short-circuit evaluation.',
    code: 'int a = 0, b = 0;\nint c = (a++ && b++) || (++a && ++b);\nprintf("%d %d %d", a, b, c);',
    // a++ yields 0 (false) so && short-circuits and b++ never runs (b stays 0); a is now 1.
    // Left operand false -> right operand evaluated: ++a -> a=2 (true), ++b -> b=1 (true) -> c=1
    options: ['1 1 1', '2 1 1', '2 2 1', '1 0 0'],
    answer: 1
  },
  {
    id: 26,
    difficulty: 'hard',
    question:
      'For the function below, how many times is f invoked in TOTAL (including the initial call) while evaluating f(5)?',
    code: 'int f(int n) {\n    if (n <= 1) return n;\n    return f(n - 1) + f(n - 2);\n}\n\n/* evaluate f(5) */',
    // calls(0)=calls(1)=1; calls(n)=1+calls(n-1)+calls(n-2)
    // calls(2)=3, calls(3)=5, calls(4)=9, calls(5)=15
    options: ['9', '15', '11', '25'],
    answer: 1
  },
  {
    id: 27,
    difficulty: 'hard',
    question: 'What does this C program print?',
    code: 'int fun(int n) {\n    static int count = 0;\n    if (n == 0) return count;\n    count++;\n    return fun(n - 1);\n}\n\nint main() {\n    printf("%d ", fun(3));\n    printf("%d", fun(2));\n    return 0;\n}',
    // static count survives between the two top-level calls:
    // fun(3) raises it to 3 and returns 3; fun(2) raises it to 5 and returns 5
    options: ['3 2', '3 5', '3 3', '5 5'],
    answer: 1
  },
  {
    id: 28,
    difficulty: 'hard',
    question: 'What is the output of this tail-recursive C function?',
    code: 'int mystery(int n, int a) {\n    if (n == 0) return a;\n    return mystery(n - 1, a * n);\n}\n\nprintf("%d", mystery(5, 1));',
    // the accumulator builds 1*5*4*3*2*1 = 120
    options: ['15', '120', '24', '720'],
    answer: 1
  },
  {
    id: 29,
    difficulty: 'hard',
    question: 'What exactly does this C program print when f(3) is called?',
    code: 'void f(int n) {\n    if (n > 0) {\n        f(n - 1);\n        printf("%d ", n);\n        f(n - 1);\n    }\n}\n\n/* call f(3) */',
    // f(1) -> "1"; f(2) -> f(1) "1", "2", f(1) "1" = "1 2 1";
    // f(3) -> "1 2 1", "3", "1 2 1"
    options: ['1 2 3 2 1', '1 2 1 3 1 2 1', '3 2 1 2 3', '1 2 1 3 2 1'],
    answer: 1
  },
  {
    id: 30,
    difficulty: 'hard',
    question:
      'What is the output of this C statement? (Assume a C99-or-later conforming compiler.)',
    code: 'printf("%d %d", -7 / 2, -7 % 2);',
    // C99 truncates division toward zero: -7/2 = -3, and -7 - (-3 * 2) = -1
    options: ['-4 1', '-3 -1', '-3 1', '-4 -1'],
    answer: 1
  },
  {
    id: 31,
    difficulty: 'hard',
    question: 'What does this Python statement print?',
    code: 'print(-7 // 2, -7 % 2)',
    // Python floors the division: -7 // 2 = -4, and the remainder takes the divisor sign: 1
    options: ['-3 -1', '-4 1', '-3 1', '-4 -1'],
    answer: 1
  },
  {
    id: 32,
    difficulty: 'hard',
    question: 'What does this Java program print?',
    code: 'int x = 10;\nint y = x++ * 2 + --x * 3;\nSystem.out.println(x + " " + y);',
    // left to right: x++ yields 10 and leaves x=11, 10*2=20;
    // --x makes x=10 and yields 10, 10*3=30; y=50, x=10
    options: ['10 50', '11 53', '10 53', '11 50'],
    answer: 0
  },
  {
    id: 33,
    difficulty: 'hard',
    question: 'What is the output of this C program fragment?',
    code: 'int a = 12, b = 10;\nprintf("%d %d %d", a & b, a | b, a ^ b);',
    // 12 = 1100, 10 = 1010 -> AND 1000 = 8, OR 1110 = 14, XOR 0110 = 6
    options: ['8 14 6', '10 12 2', '8 12 4', '2 14 8'],
    answer: 0
  },
  {
    id: 34,
    difficulty: 'hard',
    question: 'What value does this C fragment print?',
    code: 'int n = 40;\nprintf("%d", n & (n - 1));',
    // 40 = 101000, 39 = 100111, AND = 100000 = 32 (clears the lowest set bit)
    options: ['8', '32', '40', '0'],
    answer: 1
  },
  {
    id: 35,
    difficulty: 'hard',
    question: 'What is the exact output of this C program?',
    code: 'int main() {\n    printf("%d", printf("ISM"));\n    return 0;\n}',
    // the inner printf writes ISM first and returns the character count, 3
    options: ['ISM', '3ISM', 'ISM3', 'ISM0'],
    answer: 2
  },
  {
    id: 36,
    difficulty: 'hard',
    question: 'What is the final value of s printed by this C program fragment?',
    code: 'int i, j, s = 0;\nfor (i = 1; i <= 4; i++) {\n    for (j = 1; j <= 4; j++) {\n        if (j == i) continue;\n        if (j > 3) break;\n        s += j;\n    }\n}\nprintf("%d", s);',
    // i=1: j=1 skip, j=2 s=2, j=3 s=5, j=4 break
    // i=2: j=1 s=6, j=2 skip, j=3 s=9, j=4 break
    // i=3: j=1 s=10, j=2 s=12, j=3 skip, j=4 break
    // i=4: j=1 s=13, j=2 s=15, j=3 s=18, j=4 skip -> inner loop ends
    options: ['15', '18', '20', '24'],
    answer: 1
  },
  {
    id: 37,
    difficulty: 'hard',
    question: 'What is the output of this C program fragment?',
    code: 'int a[] = {1, 2, 3, 4, 5};\nint *p = a + 2;\nprintf("%d %d %d", *p, *(p - 1), p[2]);',
    // p points at a[2]=3; *(p-1)=a[1]=2; p[2]=a[4]=5
    options: ['3 2 5', '2 1 4', '3 2 4', '3 1 5'],
    answer: 0
  },
  {
    id: 38,
    difficulty: 'hard',
    question: 'What is the output of this C program fragment?',
    code: 'int a[] = {10, 20, 30, 40, 50};\nint *p = &a[1], *q = &a[4];\nprintf("%d %d", q - p, *q - *p);',
    // pointer difference counts elements, not bytes: 4 - 1 = 3; values: 50 - 20 = 30
    options: ['12 30', '3 30', '3 3', '12 40'],
    answer: 1
  },
  {
    id: 39,
    difficulty: 'hard',
    question: 'What does this C program print?',
    code: 'char s[] = "abcdef";\nint i = 0;\nwhile (s[i] != \'\\0\') {\n    if (i % 2 == 0) s[i] = s[i] - 32;\n    i++;\n}\nprintf("%s", s);',
    // subtracting 32 uppercases the characters at even indices 0, 2 and 4
    options: ['ABCDEF', 'AbCdEf', 'aBcDeF', 'abcdef'],
    answer: 1
  },
  {
    id: 40,
    difficulty: 'hard',
    question: 'What does this Python program print?',
    code: 's = "assessment"\nprint(s[2:7][::-1])',
    // "assessment" indices: 0a 1s 2s 3e 4s 5s 6m 7e 8n 9t
    // s[2:7] = "sessm"; reversed = "msses"
    options: ['msses', 'tnemss', 'msessa', 'sessm'],
    answer: 0
  },
  {
    id: 41,
    difficulty: 'hard',
    question: 'What does this Python program print?',
    code: 'a = [1, 2, 3]\nb = a\nc = a[:]\nb.append(4)\nc.append(5)\nprint(a, c)',
    // b is another name for the same list, so a becomes [1,2,3,4];
    // c is a shallow copy taken before the appends -> [1,2,3,5]
    options: [
      '[1, 2, 3] [1, 2, 3, 5]',
      '[1, 2, 3, 4] [1, 2, 3, 5]',
      '[1, 2, 3, 4, 5] [1, 2, 3, 4, 5]',
      '[1, 2, 3, 4] [1, 2, 3, 4, 5]'
    ],
    answer: 1
  },
  {
    id: 42,
    difficulty: 'hard',
    question: 'What does this Python program print?',
    code: 'funcs = []\nfor i in range(3):\n    funcs.append(lambda: i)\nprint([f() for f in funcs])',
    // late binding: all three lambdas read the same variable i, which is 2 once the loop ends
    options: ['[0, 1, 2]', '[2, 2, 2]', '[0, 0, 0]', '[3, 3, 3]'],
    answer: 1
  },
  {
    id: 43,
    difficulty: 'hard',
    question: 'What does this Java program print?',
    code: 'String a = "ISM";\nString b = "ISM";\nString c = new String("ISM");\nSystem.out.println((a == b) + " " + (a == c) + " " + a.equals(c));',
    // a and b share the interned pool literal; c is a distinct object; equals compares content
    options: ['true true true', 'true false true', 'false false true', 'true false false'],
    answer: 1
  },
  {
    id: 44,
    difficulty: 'hard',
    question: 'What does this Java program print?',
    code: 'Integer a = 127, b = 127;\nInteger c = 128, d = 128;\nSystem.out.println((a == b) + " " + (c == d));',
    // the Integer cache covers -128..127, so a and b are one object;
    // 128 is boxed into two separate objects
    options: ['true true', 'true false', 'false false', 'false true'],
    answer: 1
  },
  {
    id: 45,
    difficulty: 'hard',
    question:
      'Table Marks(id, name, score) holds the rows (1, A, 50), (2, B, NULL), (3, C, 70), (4, D, NULL) and (5, E, 90). What does this query return?',
    code: 'SELECT COUNT(*), COUNT(score), AVG(score) FROM Marks;',
    // COUNT(*) counts rows = 5; COUNT(score) skips NULLs = 3; AVG ignores NULLs = 210/3 = 70
    options: ['5 5 42', '5 3 70', '5 3 42', '3 3 70'],
    answer: 1
  },
  {
    id: 46,
    difficulty: 'hard',
    question:
      'Table Emp(dept, salary) holds (IT, 50), (IT, 70), (HR, 40), (HR, 50), (HR, 60) and (OPS, 90). Which departments does this query return?',
    code: 'SELECT dept\nFROM Emp\nGROUP BY dept\nHAVING COUNT(*) > 1 AND AVG(salary) > 55;',
    // IT: count 2, avg 60 -> passes. HR: count 3 but avg 50 -> fails. OPS: count 1 -> fails.
    options: ['IT and HR', 'IT only', 'HR and OPS', 'IT, HR and OPS'],
    answer: 1
  },
  {
    id: 47,
    difficulty: 'hard',
    question:
      'Table A has a column x with the rows 1, 2 and 3. Table B has a column y with the rows 2 and NULL. How many rows does this query return?',
    code: 'SELECT * FROM A WHERE x NOT IN (SELECT y FROM B);',
    // x NOT IN (2, NULL) is UNKNOWN for every x other than 2 (which is plainly false),
    // so no row ever satisfies the predicate
    options: ['2', '3', '0', '1'],
    answer: 2
  },
  {
    id: 48,
    difficulty: 'hard',
    question:
      'What is the tightest time complexity of this fragment in terms of n? (Assume n is a power of 2.)',
    code: 'int count = 0;\nfor (int i = 1; i <= n; i *= 2)\n    for (int j = 0; j < i; j++)\n        count++;',
    // inner work totals 1 + 2 + 4 + ... + n = 2n - 1
    options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n\u00b2)'],
    answer: 1
  },
  {
    id: 49,
    difficulty: 'hard',
    question:
      'The keys 8, 3, 10, 1, 6, 14, 4, 7, 13 are inserted in that order into an initially empty Binary Search Tree. What is the preorder traversal of the resulting tree?',
    // 8 root; 3 left of 8; 10 right of 8; 1 left of 3; 6 right of 3;
    // 14 right of 10; 4 left of 6; 7 right of 6; 13 left of 14
    options: [
      '8 3 1 6 4 7 10 14 13',
      '1 3 4 6 7 8 10 13 14',
      '8 3 10 1 6 14 4 7 13',
      '1 4 7 6 3 13 14 10 8'
    ],
    answer: 0
  },
  {
    id: 50,
    difficulty: 'hard',
    question:
      'The numbers 1, 2, 3, 4 are pushed onto a stack in that order, but pop operations may be interleaved with the pushes in any way. Which of the following output sequences is IMPOSSIBLE?',
    // 3 4 1 2 is impossible: once 3 and 4 have been popped the stack holds 1 at the bottom
    // and 2 on top, so 2 must come out before 1.
    options: ['1 2 3 4', '4 3 2 1', '3 4 2 1', '3 4 1 2'],
    answer: 3
  }
];

module.exports = questions;
