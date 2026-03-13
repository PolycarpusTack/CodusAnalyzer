import React from "react";

interface ArticleProps {
  title: string;
  content: string;
}

export function Article({ title, content }: ArticleProps) {
  // Vulnerable: dangerouslySetInnerHTML with unsanitized content
  return (
    <article className="article">
      <h1>{title}</h1>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </article>
  );
}

export function Comment({ body }: { body: string }) {
  return (
    <div className="comment">
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
