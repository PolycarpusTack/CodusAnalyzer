import React from "react";

interface ArticleProps {
  title: string;
  content: string;
}

export function Article({ title, content }: ArticleProps) {
  // Safe: rendering text content without innerHTML
  return (
    <article className="article">
      <h1>{title}</h1>
      <div className="body">
        {content.split("\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

export function Comment({ body }: { body: string }) {
  return (
    <div className="comment">
      <p>{body}</p>
    </div>
  );
}
