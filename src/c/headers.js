// The standard headers of C89, as real files under /usr/include that can be opened and read,
// and the part of the C library that is written in C itself (startup, exit, qsort, signals...).
(function (SEE) {
  'use strict';

  const SIZE_T = '#ifndef _SIZE_T\n#define _SIZE_T\ntypedef unsigned int size_t;\n#endif\n';
  const NULL_ = '#ifndef NULL\n#define NULL ((void *)0)\n#endif\n';
  const WCHAR = '#ifndef _WCHAR_T\n#define _WCHAR_T\ntypedef long wchar_t;\n#endif\n';

  const H = {};

  H['assert.h'] = `/* assert.h - diagnostics */
/* This header may be included more than once: each time, assert follows NDEBUG as it is then. */
#undef assert
#ifdef NDEBUG
#define assert(ignore) ((void)0)
#else
void __assert_fail(const char *expr, const char *file, int line);
#define assert(expr) ((expr) ? (void)0 : __assert_fail(#expr, __FILE__, __LINE__))
#endif
`;

  H['ctype.h'] = `/* ctype.h - character handling */
#ifndef _CTYPE_H
#define _CTYPE_H
int isalnum(int c);
int isalpha(int c);
int iscntrl(int c);
int isdigit(int c);
int isgraph(int c);
int islower(int c);
int isprint(int c);
int ispunct(int c);
int isspace(int c);
int isupper(int c);
int isxdigit(int c);
int tolower(int c);
int toupper(int c);
#endif
`;

  H['errno.h'] = `/* errno.h - error numbers */
#ifndef _ERRNO_H
#define _ERRNO_H
extern int errno;
#define EPERM    1
#define ENOENT   2
#define EIO      5
#define EBADF    9
#define ENOMEM  12
#define EACCES  13
#define EEXIST  17
#define ENOTDIR 20
#define EISDIR  21
#define EINVAL  22
#define EMFILE  24
#define ENOSPC  28
#define EDOM    33
#define ERANGE  34
#endif
`;

  H['float.h'] = `/* float.h - characteristics of floating types (IEEE 754 single and double) */
#ifndef _FLOAT_H
#define _FLOAT_H
#define FLT_RADIX       2
#define FLT_ROUNDS      1
#define FLT_MANT_DIG    24
#define FLT_DIG         6
#define FLT_EPSILON     1.19209290e-07F
#define FLT_MIN_EXP     (-125)
#define FLT_MIN         1.17549435e-38F
#define FLT_MIN_10_EXP  (-37)
#define FLT_MAX_EXP     128
#define FLT_MAX         3.40282347e+38F
#define FLT_MAX_10_EXP  38
#define DBL_MANT_DIG    53
#define DBL_DIG         15
#define DBL_EPSILON     2.2204460492503131e-16
#define DBL_MIN_EXP     (-1021)
#define DBL_MIN         2.2250738585072014e-308
#define DBL_MIN_10_EXP  (-307)
#define DBL_MAX_EXP     1024
#define DBL_MAX         1.7976931348623157e+308
#define DBL_MAX_10_EXP  308
/* long double is the same as double on this machine */
#define LDBL_MANT_DIG   DBL_MANT_DIG
#define LDBL_DIG        DBL_DIG
#define LDBL_EPSILON    2.2204460492503131e-16L
#define LDBL_MIN_EXP    DBL_MIN_EXP
#define LDBL_MIN        2.2250738585072014e-308L
#define LDBL_MIN_10_EXP DBL_MIN_10_EXP
#define LDBL_MAX_EXP    DBL_MAX_EXP
#define LDBL_MAX        1.7976931348623157e+308L
#define LDBL_MAX_10_EXP DBL_MAX_10_EXP
#endif
`;

  H['limits.h'] = `/* limits.h - sizes of integer types on this 32-bit machine */
#ifndef _LIMITS_H
#define _LIMITS_H
#define CHAR_BIT    8
#define SCHAR_MIN   (-128)
#define SCHAR_MAX   127
#define UCHAR_MAX   255
#define CHAR_MIN    SCHAR_MIN   /* plain char is signed here */
#define CHAR_MAX    SCHAR_MAX
#define MB_LEN_MAX  1
#define SHRT_MIN    (-32768)
#define SHRT_MAX    32767
#define USHRT_MAX   65535
#define INT_MIN     (-2147483647 - 1)
#define INT_MAX     2147483647
#define UINT_MAX    4294967295U
#define LONG_MIN    (-2147483647L - 1)
#define LONG_MAX    2147483647L
#define ULONG_MAX   4294967295UL
#endif
`;

  H['locale.h'] = `/* locale.h - localization (only the "C" locale exists here) */
#ifndef _LOCALE_H
#define _LOCALE_H
${NULL_}
struct lconv {
    char *decimal_point;
    char *thousands_sep;
    char *grouping;
    char *int_curr_symbol;
    char *currency_symbol;
    char *mon_decimal_point;
    char *mon_thousands_sep;
    char *mon_grouping;
    char *positive_sign;
    char *negative_sign;
    char int_frac_digits;
    char frac_digits;
    char p_cs_precedes;
    char p_sep_by_space;
    char n_cs_precedes;
    char n_sep_by_space;
    char p_sign_posn;
    char n_sign_posn;
};
#define LC_ALL      0
#define LC_COLLATE  1
#define LC_CTYPE    2
#define LC_MONETARY 3
#define LC_NUMERIC  4
#define LC_TIME     5
char *setlocale(int category, const char *locale);
struct lconv *localeconv(void);
#endif
`;

  H['math.h'] = `/* math.h - mathematics */
#ifndef _MATH_H
#define _MATH_H
#define HUGE_VAL (__huge_val())
double __huge_val(void);
double acos(double x);
double asin(double x);
double atan(double x);
double atan2(double y, double x);
double cos(double x);
double sin(double x);
double tan(double x);
double cosh(double x);
double sinh(double x);
double tanh(double x);
double exp(double x);
double frexp(double value, int *exp);
double ldexp(double x, int exp);
double log(double x);
double log10(double x);
double modf(double value, double *iptr);
double pow(double x, double y);
double sqrt(double x);
double ceil(double x);
double fabs(double x);
double floor(double x);
double fmod(double x, double y);
#endif
`;

  H['setjmp.h'] = `/* setjmp.h - non-local jumps */
#ifndef _SETJMP_H
#define _SETJMP_H
/* what setjmp saves: a check word, the frame depth, stack pointer, frame pointer, and where to resume */
typedef int jmp_buf[6];
int setjmp(jmp_buf env);
void longjmp(jmp_buf env, int val);
#endif
`;

  H['signal.h'] = `/* signal.h - signal handling */
#ifndef _SIGNAL_H
#define _SIGNAL_H
typedef int sig_atomic_t;
#define SIG_DFL ((void (*)(int))0)
#define SIG_ERR ((void (*)(int))-1)
#define SIG_IGN ((void (*)(int))1)
#define SIGINT   2
#define SIGILL   4
#define SIGABRT  6
#define SIGFPE   8
#define SIGSEGV 11
#define SIGTERM 15
void (*signal(int sig, void (*func)(int)))(int);
int raise(int sig);
#endif
`;

  H['stdarg.h'] = `/* stdarg.h - variable arguments */
#ifndef _STDARG_H
#define _STDARG_H
/* Arguments sit one after another on the stack, each rounded up to 4 bytes,
   so a va_list is just a pointer that walks along them. */
typedef char *va_list;
#define __va_rounded(type) ((sizeof(type) + 3) & ~3)
#define va_start(ap, last) ((ap) = (char *)&(last) + __va_rounded(last))
#define va_arg(ap, type) (*(type *)(((ap) += __va_rounded(type)) - __va_rounded(type)))
#define va_end(ap) ((void)0)
#endif
`;

  H['stddef.h'] = `/* stddef.h - common definitions */
#ifndef _STDDEF_H
#define _STDDEF_H
typedef int ptrdiff_t;
${SIZE_T}${WCHAR}${NULL_}#define offsetof(type, member) ((size_t)&((type *)0)->member)
#endif
`;

  H['stdio.h'] = `/* stdio.h - input and output */
#ifndef _STDIO_H
#define _STDIO_H
${SIZE_T}${NULL_}
typedef long fpos_t;

/* A stream. The library keeps the buffer itself; these fields show its state. */
typedef struct _iobuf {
    int _fd;        /* 0 stdin, 1 stdout, 2 stderr, 3 and up: files */
    int _flags;     /* 1 read, 2 write, 4 end of file, 8 error, 16 open */
    int _cnt;       /* bytes waiting in the buffer */
    int _bufmode;   /* _IOFBF, _IOLBF or _IONBF */
    long _pos;      /* position in the file */
    char *_name;
} FILE;

#define _IOFBF 0
#define _IOLBF 1
#define _IONBF 2
#define BUFSIZ 1024
#define EOF (-1)
#define FOPEN_MAX 20
#define FILENAME_MAX 256
#define L_tmpnam 20
#define SEEK_SET 0
#define SEEK_CUR 1
#define SEEK_END 2
#define TMP_MAX 10000

extern FILE _iob[FOPEN_MAX];
#define stdin  (&_iob[0])
#define stdout (&_iob[1])
#define stderr (&_iob[2])

int remove(const char *filename);
int rename(const char *old, const char *new);
FILE *tmpfile(void);
char *tmpnam(char *s);
int fclose(FILE *stream);
int fflush(FILE *stream);
FILE *fopen(const char *filename, const char *mode);
FILE *freopen(const char *filename, const char *mode, FILE *stream);
void setbuf(FILE *stream, char *buf);
int setvbuf(FILE *stream, char *buf, int mode, size_t size);
int fprintf(FILE *stream, const char *format, ...);
int fscanf(FILE *stream, const char *format, ...);
int printf(const char *format, ...);
int scanf(const char *format, ...);
int sprintf(char *s, const char *format, ...);
int sscanf(const char *s, const char *format, ...);
int vfprintf(FILE *stream, const char *format, char *arg);
int vprintf(const char *format, char *arg);
int vsprintf(char *s, const char *format, char *arg);
int fgetc(FILE *stream);
char *fgets(char *s, int n, FILE *stream);
int fputc(int c, FILE *stream);
int fputs(const char *s, FILE *stream);
int getc(FILE *stream);
int getchar(void);
char *gets(char *s);
int putc(int c, FILE *stream);
int putchar(int c);
int puts(const char *s);
int ungetc(int c, FILE *stream);
size_t fread(void *ptr, size_t size, size_t nmemb, FILE *stream);
size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
int fgetpos(FILE *stream, fpos_t *pos);
int fseek(FILE *stream, long offset, int whence);
int fsetpos(FILE *stream, const fpos_t *pos);
long ftell(FILE *stream);
void rewind(FILE *stream);
void clearerr(FILE *stream);
int feof(FILE *stream);
int ferror(FILE *stream);
void perror(const char *s);
#endif
`;

  H['stdlib.h'] = `/* stdlib.h - general utilities */
#ifndef _STDLIB_H
#define _STDLIB_H
${SIZE_T}${WCHAR}${NULL_}
typedef struct { int quot; int rem; } div_t;
typedef struct { long quot; long rem; } ldiv_t;
#define EXIT_FAILURE 1
#define EXIT_SUCCESS 0
#define RAND_MAX 32767
#define MB_CUR_MAX 1

double atof(const char *nptr);
int atoi(const char *nptr);
long atol(const char *nptr);
double strtod(const char *nptr, char **endptr);
long strtol(const char *nptr, char **endptr, int base);
unsigned long strtoul(const char *nptr, char **endptr, int base);
int rand(void);
void srand(unsigned int seed);
void *calloc(size_t nmemb, size_t size);
void free(void *ptr);
void *malloc(size_t size);
void *realloc(void *ptr, size_t size);
void abort(void);
int atexit(void (*func)(void));
void exit(int status);
char *getenv(const char *name);
int system(const char *string);
void *bsearch(const void *key, const void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *));
void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *));
int abs(int j);
div_t div(int numer, int denom);
long labs(long j);
ldiv_t ldiv(long numer, long denom);
int mblen(const char *s, size_t n);
int mbtowc(wchar_t *pwc, const char *s, size_t n);
int wctomb(char *s, wchar_t wchar);
size_t mbstowcs(wchar_t *pwcs, const char *s, size_t n);
size_t wcstombs(char *s, const wchar_t *pwcs, size_t n);
#endif
`;

  H['string.h'] = `/* string.h - string handling */
#ifndef _STRING_H
#define _STRING_H
${SIZE_T}${NULL_}
void *memcpy(void *s1, const void *s2, size_t n);
void *memmove(void *s1, const void *s2, size_t n);
char *strcpy(char *s1, const char *s2);
char *strncpy(char *s1, const char *s2, size_t n);
char *strcat(char *s1, const char *s2);
char *strncat(char *s1, const char *s2, size_t n);
int memcmp(const void *s1, const void *s2, size_t n);
int strcmp(const char *s1, const char *s2);
int strcoll(const char *s1, const char *s2);
int strncmp(const char *s1, const char *s2, size_t n);
size_t strxfrm(char *s1, const char *s2, size_t n);
void *memchr(const void *s, int c, size_t n);
char *strchr(const char *s, int c);
size_t strcspn(const char *s1, const char *s2);
char *strpbrk(const char *s1, const char *s2);
char *strrchr(const char *s, int c);
size_t strspn(const char *s1, const char *s2);
char *strstr(const char *s1, const char *s2);
char *strtok(char *s1, const char *s2);
void *memset(void *s, int c, size_t n);
char *strerror(int errnum);
size_t strlen(const char *s);
#endif
`;

  H['time.h'] = `/* time.h - date and time */
#ifndef _TIME_H
#define _TIME_H
${SIZE_T}${NULL_}
#define CLOCKS_PER_SEC 1000000L
typedef long clock_t;
typedef long time_t;
struct tm {
    int tm_sec;     /* seconds after the minute, 0 to 60 */
    int tm_min;     /* minutes after the hour, 0 to 59 */
    int tm_hour;    /* hours since midnight, 0 to 23 */
    int tm_mday;    /* day of the month, 1 to 31 */
    int tm_mon;     /* months since January, 0 to 11 */
    int tm_year;    /* years since 1900 */
    int tm_wday;    /* days since Sunday, 0 to 6 */
    int tm_yday;    /* days since January 1, 0 to 365 */
    int tm_isdst;   /* daylight saving time flag */
};
clock_t clock(void);
double difftime(time_t time1, time_t time0);
time_t mktime(struct tm *timeptr);
time_t time(time_t *timer);
char *asctime(const struct tm *timeptr);
char *ctime(const time_t *timer);
struct tm *gmtime(const time_t *timer);
struct tm *localtime(const time_t *timer);
size_t strftime(char *s, size_t maxsize, const char *format, const struct tm *timeptr);
#endif
`;

  // The library code written in C. It is compiled like any other file but only the parts a program
  // uses are linked in. The debugger treats these functions as library code.
  const LIBC = `/* libc.c - the parts of the C library that are written in C */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <locale.h>
#include <time.h>
#include <errno.h>

int errno;
FILE _iob[FOPEN_MAX] = { { 0, 17 }, { 1, 18, 0, 1 }, { 2, 18, 0, 2 } };

int __argc(void);
char **__argv(void);
char **__envp(void);
void __exit(int status);
void __abort(int sig);
extern int main();

/* Program start: the system calls this, it calls main, and main's value becomes the exit status. */
void _start(void)
{
    exit(main(__argc(), __argv(), __envp()));
}

static void (*atexit_funcs[32])(void);
static int atexit_count;

int atexit(void (*func)(void))
{
    if (atexit_count >= 32)
        return -1;
    atexit_funcs[atexit_count++] = func;
    return 0;
}

void exit(int status)
{
    /* functions registered with atexit run in reverse order */
    while (atexit_count > 0)
        (*atexit_funcs[--atexit_count])();
    __exit(status);   /* flushes and closes every stream, then ends the program */
}

static void (*handlers[32])(int);

void (*signal(int sig, void (*func)(int)))(int)
{
    void (*old)(int);
    if (sig < 1 || sig >= 32) {
        errno = EINVAL;
        return SIG_ERR;
    }
    old = handlers[sig];
    handlers[sig] = func;
    return old;
}

int raise(int sig)
{
    void (*h)(int);
    if (sig < 1 || sig >= 32)
        return -1;
    h = handlers[sig];
    if (h == SIG_IGN)
        return 0;
    if (h == SIG_DFL) {
        __abort(sig);
        return 0;
    }
    handlers[sig] = SIG_DFL;   /* C89: the handler is reset before it is called */
    (*h)(sig);
    return 0;
}

void abort(void)
{
    raise(SIGABRT);
    __abort(SIGABRT);   /* abort does not return, even if the handler did */
}

void __assert_fail(const char *expr, const char *file, int line)
{
    fprintf(stderr, "Assertion failed: %s, file %s, line %d\\n", expr, file, line);
    abort();
}

int abs(int j)
{
    return j < 0 ? -j : j;
}

long labs(long j)
{
    return j < 0 ? -j : j;
}

div_t div(int numer, int denom)
{
    div_t r;
    r.quot = numer / denom;
    r.rem = numer % denom;
    return r;
}

ldiv_t ldiv(long numer, long denom)
{
    ldiv_t r;
    r.quot = numer / denom;
    r.rem = numer % denom;
    return r;
}

static void swap_bytes(char *a, char *b, size_t size)
{
    char t;
    while (size-- > 0) {
        t = *a;
        *a++ = *b;
        *b++ = t;
    }
}

/* Quicksort with the middle element as pivot; small ranges use insertion sort. */
void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *))
{
    char *b = (char *)base;
    size_t i, last;
    if (nmemb < 2)
        return;
    if (nmemb <= 6) {
        size_t j;
        for (i = 1; i < nmemb; i++)
            for (j = i; j > 0 && (*compar)(b + (j - 1) * size, b + j * size) > 0; j--)
                swap_bytes(b + (j - 1) * size, b + j * size, size);
        return;
    }
    swap_bytes(b, b + (nmemb / 2) * size, size);
    last = 0;
    for (i = 1; i < nmemb; i++)
        if ((*compar)(b + i * size, b) < 0)
            swap_bytes(b + ++last * size, b + i * size, size);
    swap_bytes(b, b + last * size, size);
    qsort(b, last, size, compar);
    qsort(b + (last + 1) * size, nmemb - last - 1, size, compar);
}

void *bsearch(const void *key, const void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *))
{
    const char *b = (const char *)base;
    size_t lo = 0, hi = nmemb;
    while (lo < hi) {
        size_t mid = lo + (hi - lo) / 2;
        int c = (*compar)(key, b + mid * size);
        if (c == 0)
            return (void *)(b + mid * size);
        if (c < 0)
            hi = mid;
        else
            lo = mid + 1;
    }
    return NULL;
}

void __localtime(time_t t, struct tm *tm, int utc);
void __asctime(const struct tm *tm, char *buf);

struct tm *gmtime(const time_t *timer)
{
    static struct tm tm;
    __localtime(*timer, &tm, 1);
    return &tm;
}

struct tm *localtime(const time_t *timer)
{
    static struct tm tm;
    __localtime(*timer, &tm, 0);
    return &tm;
}

char *asctime(const struct tm *timeptr)
{
    static char buf[26];
    __asctime(timeptr, buf);
    return buf;
}

char *ctime(const time_t *timer)
{
    return asctime(localtime(timer));
}

char *tmpnam(char *s)
{
    static char name[L_tmpnam];
    static int count;
    if (s == NULL)
        s = name;
    sprintf(s, "/tmp/tmp%05d", ++count);
    return s;
}

char *setlocale(int category, const char *locale)
{
    static char c[] = "C";
    if (category < LC_ALL || category > LC_TIME)
        return NULL;
    if (locale == NULL || locale[0] == '\\0' || strcmp(locale, "C") == 0)
        return c;
    return NULL;
}

struct lconv *localeconv(void)
{
    static struct lconv lc = { ".", "", "", "", "", "", "", "", "", "", 127, 127, 127, 127, 127, 127, 127, 127 };
    return &lc;
}

char *strerror(int errnum)
{
    switch (errnum) {
    case 0: return "Success";
    case EPERM: return "Operation not permitted";
    case ENOENT: return "No such file or directory";
    case EIO: return "Input/output error";
    case EBADF: return "Bad file descriptor";
    case ENOMEM: return "Cannot allocate memory";
    case EACCES: return "Permission denied";
    case EEXIST: return "File exists";
    case ENOTDIR: return "Not a directory";
    case EISDIR: return "Is a directory";
    case EINVAL: return "Invalid argument";
    case EMFILE: return "Too many open files";
    case ENOSPC: return "No space left on device";
    case EDOM: return "Numerical argument out of domain";
    case ERANGE: return "Numerical result out of range";
    }
    return "Unknown error";
}

void perror(const char *s)
{
    if (s != NULL && *s != '\\0')
        fprintf(stderr, "%s: %s\\n", s, strerror(errno));
    else
        fprintf(stderr, "%s\\n", strerror(errno));
}
`;

  SEE.Headers = { files: H, libc: LIBC, names: Object.keys(H).sort() };
})(SEE);
