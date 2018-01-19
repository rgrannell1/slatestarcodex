
# SlateStarCodex

![Example PDF](readme/example.png "Example PDF")

Extract posts from http://slatestarcodex.com/ and render them as a PDF.

## Why?

SlateStarCodex is an excellent blog, and I like to read it on my Kindle. I don't find the site itself that readable, and given that the blog is a collection of essay's it makes sense to compile it into book-format.  

## Usage


## Notes 

Note that this program runs slowly, deliberatly. The blog's [robots.txt](http://slatestarcodex.com/robots.txt) doesn't specifiy a rate-limit, but I  don't want to accidentally DOS the site so all download requests run sequentially, and a local copy of posts is maintained in a database.
